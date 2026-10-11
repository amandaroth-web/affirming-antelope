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

-- Anonymous users practise and sync their own rows, and nothing else.
select plan(40);

select tests.as_postgres();
insert into tests.ids values
  ('anon_a', tests.create_anon_user()),
  ('anon_b', tests.create_anon_user()),
  ('a_session', gen_random_uuid());

select is((select display_name from public.profiles where id = tests.id('anon_a')), 'Learner',
  'an anonymous user gets a profile named Learner');

-- ---------------------------------------------------------------- own rows
select tests.as_anon_user(tests.id('anon_a'));

select lives_ok($$ insert into public.learner_state (user_id, state, version)
                   values (tests.id('anon_a'), '{"firstName":"Sam","currentWeek":2}', 1) $$,
  'anon: inserts own learner_state');
select lives_ok($$ update public.learner_state set state = '{"firstName":"Sam","currentWeek":3}', version = 2
                    where user_id = tests.id('anon_a') $$,
  'anon: updates own learner_state');
select throws_ok($$ update public.learner_state set state = '{}', version = 2 where user_id = tests.id('anon_a') $$,
  'PT409', null, 'anon: the version guard still applies');
select lives_ok($$ insert into public.activity_completions (client_id, kind, ref_id, skill, minutes)
                   values (gen_random_uuid(), 'drill', 'oars-1', 'oars', 3) $$,
  'anon: inserts own completion');
select lives_ok($$ insert into public.practice_sessions (id, client_id, kind, ref_id, skill, transcript)
                   values (tests.id('a_session'), gen_random_uuid(), 'roleplay', 'PM-017', 'evoking', '[]') $$,
  'anon: inserts own practice session');
select lives_ok($$ update public.practice_sessions set ended_at = now() where id = tests.id('a_session') $$,
  'anon: updates own practice session');
select is((select count(*)::int from public.learner_state), 1, 'anon: reads own learner_state');
select is((select count(*)::int from public.activity_completions), 1, 'anon: reads own completions');
select is((select count(*)::int from public.practice_sessions), 1, 'anon: reads own sessions');
select is((select count(*)::int from public.profiles), 1, 'anon: reads only own profile');
select lives_ok($$ update public.profiles set display_name = 'Sam' where id = tests.id('anon_a') $$,
  'anon: renames self');
select throws_ok($$ insert into public.learner_state (user_id, state) values (tests.id('anon_b'), '{}') $$,
  '42501', null, 'anon: cannot write someone else''s learner_state');
select throws_ok($$ insert into public.practice_sessions (user_id, client_id, kind, ref_id)
                    values (tests.uid('amanda'), gen_random_uuid(), 'drill', 'x') $$,
  '42501', null, 'anon: cannot write someone else''s session');

-- ---------------------------------------------------------------- can't see others
select is((select count(*)::int from public.practice_sessions where user_id = tests.uid('amanda')), 0,
  'anon: no other learner''s sessions');
select is((select count(*)::int from public.learner_state where user_id <> tests.id('anon_a')), 0,
  'anon: no other learner_state');
select is((select count(*)::int from public.profiles where id = tests.uid('rosa')), 0,
  'anon: cannot read trainer profiles');
select is((select count(*)::int from public.cohorts), 0, 'anon: no cohorts');
select is((select count(*)::int from public.cohort_members), 0, 'anon: no cohort members');
select is((select count(*)::int from public.submissions), 0, 'anon: no submissions');
select is((select count(*)::int from public.reviews), 0, 'anon: no reviews');
select is((select count(*)::int from public.assignments), 0, 'anon: no assignments');
select is((select count(*)::int from public.assignment_items), 0, 'anon: no assignment items');
select is((select count(*)::int from public.assignment_progress(tests.assignment())), 0, 'anon: no assignment progress');
select is((select count(*)::int from public.cohort_member_stats(tests.cohort())), 0, 'anon: no cohort stats');

-- ---------------------------------------------------------------- can't join, submit, claim
select throws_ok($$ select public.join_cohort('MIL-DEMO') $$, '42501',
  'Sign in with your email to join a cohort', 'anon: join_cohort says sign in');
select throws_ok($$ select public.claim_trainer('TRAIN-PILOT') $$, '42501',
  'Sign in with your email to claim a trainer code', 'anon: claim_trainer says sign in');
select throws_ok($$ select public.create_cohort('Mine', null) $$, '42501',
  'Sign in with your email to create a cohort', 'anon: create_cohort says sign in');
select throws_ok($$ insert into public.submissions (session_id, cohort_id) values (tests.id('a_session'), tests.cohort()) $$,
  '42501', 'Sign in with your email to send a session for review', 'anon: submitting says sign in');
select throws_ok($$ insert into storage.objects (bucket_id, name)
                    values ('review-audio', 'c0c0c0c0-0000-4000-8000-000000000001/5b5b5b5b-0000-4000-8000-000000000002/0e0e0e0e-0000-4000-8000-000000000009.m4a') $$,
  '42501', null, 'anon: cannot upload review audio');

-- ---------------------------------------------------------------- other anonymous user
select tests.as_anon_user(tests.id('anon_b'));
select is((select count(*)::int from public.learner_state) + (select count(*)::int from public.activity_completions)
          + (select count(*)::int from public.practice_sessions), 0,
  'anon B sees none of anon A''s rows');
select is((select count(*)::int from public.profiles), 1, 'anon B sees only own profile');

-- ---------------------------------------------------------------- fail closed
select tests.as_postgres();
select set_config('request.jwt.claims', json_build_object('sub', tests.uid('amanda'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select is((select count(*)::int from public.cohorts), 0, 'a JWT without is_anonymous counts as anonymous');

-- ---------------------------------------------------------------- permanent users unaffected
select tests.as_user(tests.uid('amanda'));
select is((select count(*)::int from public.cohorts), 1, 'permanent learner still sees her cohort');
select is((select count(*)::int from public.profiles where id = tests.uid('rosa')), 1,
  'permanent learner still sees her trainer');
select tests.as_user(tests.uid('rosa'));
select ok((select count(*)::int from public.profiles) >= 5, 'trainer still sees her learners');

-- ---------------------------------------------------------------- after conversion
-- updateUser({ email }) + verifyOtp flips is_anonymous; the next JWT carries false.
select tests.as_postgres();
update auth.users set is_anonymous = false, email = 'sam@example.com', email_confirmed_at = now()
 where id = tests.id('anon_a');
select tests.as_user(tests.id('anon_a'));

select is((select count(*)::int from public.learner_state) + (select count(*)::int from public.activity_completions)
          + (select count(*)::int from public.practice_sessions), 3,
  'converted: same uid keeps its practice');
select is((select id from public.join_cohort('MIL-DEMO')), tests.cohort(), 'converted: joins a cohort');
select lives_ok($$ insert into public.submissions (session_id, cohort_id) values (tests.id('a_session'), tests.cohort()) $$,
  'converted: submits a session for review');
select is((select count(*)::int from public.profiles where id = tests.uid('rosa')), 1,
  'converted: reads the cohort trainer''s profile');

select * from finish();
rollback;
