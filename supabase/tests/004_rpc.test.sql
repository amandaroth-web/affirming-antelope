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
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
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
grant execute on all functions in schema tests to anon, authenticated;

-- RPCs: join_cohort, create_cohort, claim_trainer, rotate_join_code,
-- assignment_progress and cohort_member_stats against the seed.
select plan(34);

select tests.as_postgres();
do $$
declare
  t uuid := tests.create_user('other.trainer@example.com', 'Other Trainer');
begin
  perform tests.create_user('newbie@example.com');
  perform tests.create_user('stranger@example.com', 'Stranger');
  update public.profiles set can_train = true where id = t;
  insert into public.cohorts (id, name, trainer_id, join_code, archived_at)
  values ('c0c0c0c0-0000-4000-8000-0000000000b2', 'Archived cohort', t, 'MIL-OLD2', now());
  insert into app_private.trainer_codes (code, expires_at) values ('EXPIRED-1', now() - interval '1 day');
  insert into app_private.trainer_codes (code, max_uses) values ('ONE-SHOT', 1);
end $$;

create or replace function tests.user_by_email(e text) returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where email = e
$$;
grant execute on function tests.user_by_email(text) to authenticated;

select is((select display_name from public.profiles where id = tests.user_by_email('newbie@example.com')), 'newbie',
  'new profiles default display_name to the email''s local part');

-- ---- join_cohort ------------------------------------------------------------
select tests.as_user(tests.user_by_email('newbie@example.com'));
select is((select id from public.join_cohort('MIL-DEMO')), tests.cohort(), 'join_cohort returns the cohort');
select is((select id from public.join_cohort('MIL-DEMO')), tests.cohort(), 'joining again is fine');
select is((select count(*)::int from public.cohort_members where cohort_id = tests.cohort()), 1,
  'joining twice leaves one membership row');
select is((select role from public.cohort_members where cohort_id = tests.cohort()), 'learner', 'joined as a learner');
select is((select id from public.join_cohort('  mil demo ')), tests.cohort(), 'codes are normalized (case, spaces)');
select is((select id from public.join_cohort('mildemo')), tests.cohort(), 'codes are normalized (no hyphen)');
select is((select id from public.join_cohort('demo')), tests.cohort(), 'the MIL- prefix is optional');
select throws_ok($$ select public.join_cohort('MIL-ZZZZ') $$, 'PT404', null, 'unknown code is rejected');
select throws_ok($$ select public.join_cohort('') $$, 'PT404', null, 'empty code is rejected');
select throws_ok($$ select public.join_cohort(null) $$, 'PT404', null, 'null code is rejected');
select throws_ok($$ select public.join_cohort('MIL-DEMO''; drop table public.cohorts; --') $$, 'PT404', null, 'junk is rejected');
select throws_ok($$ select public.join_cohort('MIL-OLD2') $$, 'PT404', null, 'archived cohorts cannot be joined');

select tests.as_user(tests.uid('rosa'));
select lives_ok($$ select public.join_cohort('MIL-DEMO') $$, 'the trainer can call join_cohort on her own cohort');
select is((select role from public.cohort_members where cohort_id = tests.cohort() and user_id = tests.uid('rosa')), 'trainer',
  'join_cohort never demotes a trainer');

-- ---- create_cohort / claim_trainer --------------------------------------------
select tests.as_user(tests.uid('jordan'));
select throws_ok($$ select public.create_cohort('Jordan''s cohort', null) $$, '42501', null, 'create_cohort requires can_train');
select is(public.claim_trainer('WRONG-CODE'), false, 'claim_trainer rejects a bad code');
select is(public.claim_trainer('EXPIRED-1'), false, 'claim_trainer rejects an expired code');
select is((select can_train from public.profiles where id = tests.uid('jordan')), false, 'can_train still false');
select is(public.claim_trainer(' train-pilot '), true, 'claim_trainer accepts TRAIN-PILOT (normalized)');
select is((select can_train from public.profiles where id = tests.uid('jordan')), true, 'can_train is now true');
select is(public.claim_trainer('ONE-SHOT'), true, 'Jordan claims a one-use code');
select is(public.claim_trainer('ONE-SHOT'), true, 'reclaiming your own code stays true');

select results_eq(
  $$ select name, join_code ~ '^MIL-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$', trainer_id = tests.uid('jordan')
       from public.create_cohort('Jordan''s cohort', '2026-11-02') $$,
  $$ values ('Jordan''s cohort'::text, true, true) $$,
  'create_cohort works after claiming, with a generated join code');
select is(
  (select m.role from public.cohort_members m join public.cohorts c on c.id = m.cohort_id
    where c.name = 'Jordan''s cohort' and m.user_id = tests.uid('jordan')),
  'trainer', 'the creator is the cohort''s trainer member');

select tests.as_user(tests.uid('priya'));
select is(public.claim_trainer('ONE-SHOT'), false, 'a used-up code is rejected for the next person');

-- ---- rotate_join_code ---------------------------------------------------------
select tests.as_user(tests.uid('amanda'));
select throws_ok($$ select public.rotate_join_code(tests.cohort()) $$, '42501', null, 'a learner cannot rotate the code');

-- ---- assignment_progress / cohort_member_stats (seed numbers) -------------------
select tests.as_user(tests.uid('rosa'));
select results_eq(
  $$ select display_name, done, quantity from public.assignment_progress(tests.assignment()) $$,
  $$ values ('Amanda'::text, 2, 2), ('Amanda', 0, 1),
            ('Jordan', 1, 2), ('Jordan', 1, 1),
            ('Marcus', 2, 2), ('Marcus', 1, 1),
            ('newbie', 0, 2), ('newbie', 0, 1),
            ('Priya', 0, 2), ('Priya', 0, 1) $$,
  'assignment_progress: trainer sees every learner x item (seed + the newbie who joined above)');
select results_eq(
  $$ select display_name, assigned, completed, needs_review, last_active_at is not null from public.cohort_member_stats(tests.cohort()) $$,
  $$ values ('Amanda'::text, 3, 2, 1, true), ('Jordan', 3, 2, 0, true), ('Marcus', 3, 3, 0, true),
            ('newbie', 3, 0, 0, false), ('Priya', 3, 0, 0, true) $$,
  'cohort_member_stats matches the seed');

select tests.as_user(tests.uid('amanda'));
select results_eq(
  $$ select user_id, done, quantity from public.assignment_progress(tests.assignment()) $$,
  $$ values (tests.uid('amanda'), 2, 2), (tests.uid('amanda'), 0, 1) $$,
  'assignment_progress: a learner sees only her own rows');
select is((select count(*)::int from public.cohort_member_stats(tests.cohort())), 0, 'cohort_member_stats returns nothing to a learner');

select tests.as_user(tests.user_by_email('stranger@example.com'));
select is((select count(*)::int from public.assignment_progress(tests.assignment())), 0, 'assignment_progress returns nothing to a non-member');

-- rotate last: it invalidates MIL-DEMO for the rest of this transaction
select tests.as_user(tests.uid('rosa'));
select ok((select public.rotate_join_code(tests.cohort())) ~ '^MIL-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$',
  'the trainer rotates the join code');
select tests.as_user(tests.user_by_email('stranger@example.com'));
select throws_ok($$ select public.join_cohort('MIL-DEMO') $$, 'PT404', null, 'the old code stops working');

select * from finish();
rollback;
