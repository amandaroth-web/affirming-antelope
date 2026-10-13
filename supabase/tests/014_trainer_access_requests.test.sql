-- Shared header: helpers are created inside this file's transaction and rolled back.
begin;
create extension if not exists pgtap with schema extensions;

-- Test helpers (rolled back with the file's transaction).
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Seed fixtures (supabase/seed.sql).
create or replace function tests.uid(who text) returns uuid language sql immutable as $$
  select case who
    when 'rosa'   then '11111111-1111-4111-8111-111111111111'
    when 'amanda' then '22222222-2222-4222-8222-222222222222'
    when 'jordan' then '33333333-3333-4333-8333-333333333333'
    when 'priya'  then '44444444-4444-4444-8444-444444444444'
    when 'marcus' then '55555555-5555-4555-8555-555555555555'
  end::uuid
$$;
create or replace function tests.cohort() returns uuid language sql immutable as $$ select 'c0c0c0c0-0000-4000-8000-000000000001'::uuid $$;
create or replace function tests.assignment() returns uuid language sql immutable as $$ select 'a5a5a5a5-0000-4000-8000-000000000001'::uuid $$;
create or replace function tests.amanda_roleplay() returns uuid language sql immutable as $$ select '5e5e5e5e-0000-4000-8000-000000000001'::uuid $$;
create or replace function tests.amanda_drill() returns uuid language sql immutable as $$ select '5e5e5e5e-0000-4000-8000-000000000002'::uuid $$;
create or replace function tests.marcus_roleplay() returns uuid language sql immutable as $$ select '5e5e5e5e-0000-4000-8000-000000000003'::uuid $$;
create or replace function tests.amanda_submission() returns uuid language sql immutable as $$ select '5b5b5b5b-0000-4000-8000-000000000001'::uuid $$;
create or replace function tests.marcus_submission() returns uuid language sql immutable as $$ select '5b5b5b5b-0000-4000-8000-000000000002'::uuid $$;
create or replace function tests.marcus_review() returns uuid language sql immutable as $$ select '7e7e7e7e-0000-4000-8000-000000000001'::uuid $$;

-- Create an auth user (the trigger creates the profile). Run as postgres.
create or replace function tests.create_user(email text, display_name text default null) returns uuid
language plpgsql as $$
declare new_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', email, '',
          now(), '{"provider":"email","providers":["email"]}',
          case when display_name is null then '{}'::jsonb else jsonb_build_object('display_name', display_name) end,
          now(), now());
  return new_id;
end $$;

-- Become a signed-in user / anon for the rest of the transaction (until `reset role`).
create or replace function tests.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function tests.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
-- Back to postgres with no JWT (auth.uid() is null), for fixture setup.
create or replace function tests.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

-- Anonymous users (signInAnonymously): no email, auth.users.is_anonymous = true, and
-- `is_anonymous: true` in the JWT.
create or replace function tests.create_anon_user() returns uuid
language plpgsql as $$
declare new_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', true,
          '{}', '{}', now(), now());
  return new_id;
end $$;
create or replace function tests.as_anon_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
-- Named ids shared across role switches.
create table if not exists tests.ids (name text primary key, id uuid not null);
grant select on tests.ids to anon, authenticated, service_role;
create or replace function tests.id(n text) returns uuid language sql stable as $$
  select id from tests.ids where name = n
$$;
grant usage on schema tests to service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

create or replace function tests.as_service_role() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
grant execute on function tests.as_service_role() to service_role, authenticated;

-- Trainer access requests: request -> admin approves -> can_train. Codes still work.
select plan(43);

select tests.as_postgres();
insert into tests.ids values
  ('ana', tests.create_user('ana@example.com', 'Ana Ruiz')),
  ('ben', tests.create_user('ben@example.com', 'Ben Ode')),
  ('carl', tests.create_user('carl@example.com', 'Carl')),
  ('dee', tests.create_user('dee@example.com', 'Dee')),
  ('admin', tests.create_user('admin@example.com', 'Admin')),
  ('guest', tests.create_anon_user());

-- ---------------------------------------------------------------- anonymous users can't request
select tests.as_anon();
select throws_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count)
                   values (tests.id('ana'), 'Ana', 'Clinic', '1-10') $$,
  '42501', null, 'signed out: can''t insert a request');
select throws_ok($$ select count(*) from public.trainer_access_requests $$,
  '42501', null, 'signed out: can''t read requests');

select tests.as_anon_user(tests.id('guest'));
select throws_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count)
                   values (tests.id('guest'), 'Guest', 'Clinic', '1-10') $$,
  '42501', 'Sign in with your email to request trainer access', 'anonymous user: can''t request access');
select is((select count(*)::int from public.trainer_access_requests), 0, 'anonymous user: reads nothing');

-- ---------------------------------------------------------------- a user files their own request
select tests.as_user(tests.id('ana'));
select lives_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count, note)
                   values (tests.id('ana'), 'Ana Ruiz', 'Northside Clinic', '11-30', 'Leading our MI pilot') $$,
  'ana: requests access');
select throws_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count)
                   values (tests.id('ana'), 'Ana Ruiz', 'Northside Clinic', '11-30') $$,
  '23505', null, 'ana: only one pending request per user');
select throws_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count)
                   values (tests.id('ben'), 'Not Ben', 'Somewhere', '1-10') $$,
  '42501', null, 'ana: can''t file a request for someone else');
select throws_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count, status)
                   values (tests.id('ana'), 'Ana Ruiz', 'Northside Clinic', '11-30', 'approved') $$,
  '42501', null, 'ana: can''t insert an approved request');
select throws_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count, note)
                   values (tests.id('ana'), 'Ana', 'Clinic', 'lots', null) $$,
  '23514', null, 'learner_count must be one of the buckets');
select throws_ok(format($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count, note)
                   values (%L, 'Ana', 'Clinic', '1-10', %L) $$, tests.id('ana'), repeat('x', 501)),
  '23514', null, 'note is at most 500 characters');
select is((select count(*)::int from public.trainer_access_requests), 1, 'ana: reads her own request');
select is((select status from public.trainer_access_requests where user_id = tests.id('ana')), 'pending',
  'a new request is pending');

select tests.as_user(tests.id('ben'));
select lives_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count)
                   values (tests.id('ben'), 'Ben Ode', 'Eastside Health', '100+') $$,
  'ben: requests access');
select is((select count(*)::int from public.trainer_access_requests), 1, 'ben: sees only his own request');
select is((select count(*)::int from public.trainer_access_requests where user_id = tests.id('ana')), 0,
  'ben: can''t see ana''s request');

-- ---------------------------------------------------------------- nobody approves themselves
select tests.as_user(tests.id('ana'));
select throws_ok($$ update public.trainer_access_requests set status = 'approved' where user_id = tests.id('ana') $$,
  '42501', null, 'ana: can''t change her request''s status');
select throws_ok($$ update public.trainer_access_requests set decided_at = now() where user_id = tests.id('ana') $$,
  '42501', null, 'ana: can''t set decided_at');
select throws_ok($$ delete from public.trainer_access_requests where user_id = tests.id('ana') $$,
  '42501', null, 'ana: can''t delete requests');
select throws_ok(format($$ select public.admin_decide_trainer_request(%L, true, %L) $$,
                   (select id from public.trainer_access_requests where user_id = tests.id('ana')), tests.id('ana')),
  '42501', null, 'ana: can''t call admin_decide_trainer_request');
select throws_ok($$ select * from public.admin_pending_trainer_requests() $$, '42501', null,
  'ana: can''t list pending requests');
select throws_ok($$ select * from public.admin_trainers() $$, '42501', null, 'ana: can''t list trainers');
select throws_ok($$ select * from public.admin_trainer_codes() $$, '42501', null, 'ana: can''t list trainer codes');
select throws_ok($$ select * from public.admin_create_trainer_code('TRAIN-MINE', null, null, null) $$, '42501', null,
  'ana: can''t create trainer codes');
select throws_ok($$ update public.profiles set can_train = true where id = tests.id('ana') $$, '42501', null,
  'ana: can''t set can_train herself');
select is((select can_train from public.profiles where id = tests.id('ana')), false, 'ana: still not a trainer');

select tests.as_anon();
select throws_ok($$ select * from public.admin_pending_trainer_requests() $$, '42501', null,
  'signed out: can''t list pending requests');

select tests.as_user(tests.uid('rosa'));
select throws_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count)
                   values (tests.uid('rosa'), 'Rosa', 'Clinic', '1-10') $$,
  'PT409', 'You already have trainer access', 'an existing trainer can''t request');

-- ---------------------------------------------------------------- admins decide (service role)
select tests.as_service_role();
select is((select count(*)::int from public.admin_pending_trainer_requests()), 2, 'admin: lists both pending requests');
select is((select email from public.admin_pending_trainer_requests() where user_id = tests.id('ana')), 'ana@example.com',
  'admin: sees the requester''s email');
select is((public.admin_decide_trainer_request(
             (select id from public.trainer_access_requests where user_id = tests.id('ana')), true, tests.id('admin'))
          )->>'status', 'approved', 'admin: approves ana');
select throws_ok(format($$ select public.admin_decide_trainer_request(%L, false, %L) $$,
                   (select id from public.trainer_access_requests where user_id = tests.id('ana')), tests.id('admin')),
  'PT409', null, 'a decided request can''t be decided again');
select is((public.admin_decide_trainer_request(
             (select id from public.trainer_access_requests where user_id = tests.id('ben')), false, tests.id('admin'))
          )->>'status', 'declined', 'admin: declines ben');

select tests.as_postgres();
select is((select can_train from public.profiles where id = tests.id('ana')), true, 'approving sets can_train');
select ok((select decided_at is not null and decided_by = tests.id('admin')
             from public.trainer_access_requests where user_id = tests.id('ana')),
  'approving records decided_at and decided_by');
select is((select can_train from public.profiles where id = tests.id('ben')), false, 'declining leaves can_train off');

-- ---------------------------------------------------------------- declined: wait 7 days
select tests.as_user(tests.id('ben'));
select throws_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count)
                   values (tests.id('ben'), 'Ben Ode', 'Eastside Health', '100+') $$,
  'PT429', null, 'declined: can''t ask again within 7 days');
select tests.as_postgres();
update public.trainer_access_requests set decided_at = now() - interval '8 days' where user_id = tests.id('ben');
select tests.as_user(tests.id('ben'));
select lives_ok($$ insert into public.trainer_access_requests (user_id, name, organization, learner_count)
                   values (tests.id('ben'), 'Ben Ode', 'Eastside Health', '100+') $$,
  'declined: can ask again after 7 days');

-- ---------------------------------------------------------------- trainers and codes
select tests.as_service_role();
select ok(exists (select 1 from public.admin_trainers() where user_id = tests.id('ana') and cohort_count = 0),
  'admin: ana shows up as a trainer');
select is((select code from public.admin_create_trainer_code('TRAIN-AMANDA', 1, now() + interval '30 days', 'Amanda')),
  'TRAIN-AMANDA', 'admin: creates TRAIN-AMANDA');
select throws_ok($$ select * from public.admin_create_trainer_code('TRAIN-AMANDA', 1, null, null) $$, '23505', null,
  'trainer codes are unique');
select throws_ok($$ select * from public.admin_create_trainer_code('TRAIN-a!', null, null, null) $$, '22023', null,
  'trainer codes are validated');

-- claim_trainer(code) still works, and max_uses holds.
select tests.as_user(tests.id('carl'));
select is(public.claim_trainer(' train-amanda '), true, 'claim_trainer still works with a new code');
select tests.as_user(tests.id('dee'));
select is(public.claim_trainer('TRAIN-AMANDA'), false, 'a 1-use code works once');

select * from finish();
rollback;
