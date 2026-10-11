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
grant execute on all functions in schema tests to anon, authenticated;

-- Learners never see each other's data, even inside the same cohort, and can't
-- grant themselves anything.
select plan(42);

-- A second cohort Jordan is NOT in.
select tests.as_postgres();
do $$
declare t uuid := tests.create_user('other.trainer@example.com', 'Other Trainer');
begin
  update public.profiles set can_train = true where id = t;
  insert into public.cohorts (id, name, trainer_id, join_code)
  values ('c0c0c0c0-0000-4000-8000-0000000000b2', 'Other cohort', t, 'MIL-ZZZ9');
  insert into public.cohort_members (cohort_id, user_id, role)
  values ('c0c0c0c0-0000-4000-8000-0000000000b2', t, 'trainer');
end $$;

-- ---- Jordan, a learner in the same cohort as Amanda --------------------------
select tests.as_user(tests.uid('jordan'));

select is((select count(*)::int from public.practice_sessions where user_id = tests.uid('amanda')), 0,
  'Jordan cannot read Amanda''s sessions');
select is((select count(*)::int from public.practice_sessions where id = tests.amanda_roleplay()), 0,
  'Jordan cannot read Amanda''s submitted session either');
select is((select count(*)::int from public.activity_completions where user_id <> tests.uid('jordan')), 0,
  'Jordan sees only his own completions');
select is((select count(*)::int from public.activity_completions), 2, 'Jordan sees his 2 completions');
select is((select count(*)::int from public.learner_state), 0, 'Jordan cannot read Amanda''s learner_state');
select is((select count(*)::int from public.submissions), 0, 'Jordan sees no one else''s submissions');
select is((select count(*)::int from public.reviews), 0, 'Jordan sees no one else''s reviews');
select results_eq('select id from public.profiles order by id', array[tests.uid('rosa'), tests.uid('jordan')], 'Jordan reads only his own profile and his cohort trainer''s');
select results_eq('select user_id from public.cohort_members', array[tests.uid('jordan')],
  'Jordan sees only his own membership row');
select is((select count(*)::int from public.cohorts), 1, 'Jordan can read his cohort');
select is((select count(*)::int from public.cohorts where id = 'c0c0c0c0-0000-4000-8000-0000000000b2'), 0,
  'Jordan cannot read a cohort he is not in');
select is((select count(*)::int from public.assignments), 1, 'Jordan reads his cohort''s assignment');
select is((select count(*)::int from public.assignment_items), 2, 'Jordan reads its items');

select results_eq(
  $$ with u as (update public.learner_state set version = version + 1 where user_id = tests.uid('amanda') returning 1)
     select count(*)::int from u $$,
  array[0], 'Jordan cannot update Amanda''s learner_state');
select results_eq(
  $$ with d as (delete from public.practice_sessions where user_id = tests.uid('amanda') returning 1)
     select count(*)::int from d $$,
  array[0], 'Jordan cannot delete Amanda''s sessions');
select throws_ok(
  $$ insert into public.activity_completions (user_id, client_id, kind, ref_id)
     values (tests.uid('amanda'), gen_random_uuid(), 'drill', 'drill-evoking-01') $$,
  '42501', null, 'Jordan cannot insert a completion as Amanda');
select throws_ok(
  $$ insert into public.practice_sessions (user_id, client_id, kind, ref_id)
     values (tests.uid('amanda'), gen_random_uuid(), 'drill', 'drill-evoking-01') $$,
  '42501', null, 'Jordan cannot insert a session as Amanda');
select throws_ok(
  $$ insert into public.learner_state (user_id, state) values (tests.uid('priya'), '{}') $$,
  '42501', null, 'Jordan cannot create learner_state for someone else');

-- Privilege escalation attempts
select throws_ok(
  $$ update public.profiles set can_train = true where id = tests.uid('jordan') $$,
  '42501', null, 'Jordan cannot set his own can_train');
select lives_ok(
  $$ update public.profiles set display_name = 'Jordan P.' where id = tests.uid('jordan') $$,
  'Jordan can rename himself');
select throws_ok(
  $$ update public.cohort_members set role = 'trainer' where user_id = tests.uid('jordan') $$,
  '42501', null, 'Jordan cannot change his cohort role');
select throws_ok(
  $$ insert into public.cohort_members (cohort_id, user_id, role) values (tests.cohort(), tests.uid('jordan'), 'trainer') $$,
  '42501', null, 'Jordan cannot insert memberships directly');
select throws_ok(
  $$ select * from app_private.trainer_codes $$,
  '42501', null, 'Jordan cannot read trainer codes');
select throws_ok(
  $$ insert into public.assignments (cohort_id, title) values (tests.cohort(), 'Skip everything') $$,
  '42501', null, 'Jordan cannot create assignments');

-- Submissions
select throws_ok(
  $$ insert into public.submissions (session_id, user_id, cohort_id) values (tests.amanda_drill(), tests.uid('jordan'), tests.cohort()) $$,
  '42501', null, 'Jordan cannot submit Amanda''s session');
select throws_ok(
  $$ insert into public.submissions (session_id, user_id, cohort_id) values (tests.amanda_drill(), tests.uid('amanda'), tests.cohort()) $$,
  '42501', null, 'Jordan cannot submit on Amanda''s behalf');

insert into public.practice_sessions (id, client_id, kind, ref_id, skill)
values ('5e5e5e5e-0000-4000-8000-0000000000f1', gen_random_uuid(), 'roleplay', 'EN-003', 'engaging');

select throws_ok(
  $$ insert into public.submissions (session_id, cohort_id) values ('5e5e5e5e-0000-4000-8000-0000000000f1', 'c0c0c0c0-0000-4000-8000-0000000000b2') $$,
  '42501', null, 'Jordan cannot submit to a cohort he is not in');
select throws_ok(
  $$ insert into public.submissions (session_id, cohort_id, status) values ('5e5e5e5e-0000-4000-8000-0000000000f1', tests.cohort(), 'reviewed') $$,
  '42501', null, 'Jordan cannot insert a pre-reviewed submission');
select lives_ok(
  $$ insert into public.submissions (id, session_id, cohort_id, note_to_trainer)
     values ('5b5b5b5b-0000-4000-8000-0000000000f1', '5e5e5e5e-0000-4000-8000-0000000000f1', tests.cohort(), 'Thoughts?') $$,
  'Jordan submits his own session to his cohort');
select throws_ok(
  $$ update public.submissions set status = 'reviewed' where id = '5b5b5b5b-0000-4000-8000-0000000000f1' $$,
  '42501', null, 'Jordan cannot mark his own submission reviewed');
select throws_ok(
  $$ update public.submissions set reviewed_at = now() where id = '5b5b5b5b-0000-4000-8000-0000000000f1' $$,
  '42501', null, 'Jordan cannot set reviewed_at');
select lives_ok(
  $$ update public.submissions set status = 'withdrawn' where id = '5b5b5b5b-0000-4000-8000-0000000000f1' $$,
  'Jordan withdraws while submitted');
select results_eq(
  $$ with u as (update public.submissions set status = 'submitted' where id = '5b5b5b5b-0000-4000-8000-0000000000f1' returning 1)
     select count(*)::int from u $$,
  array[0], 'a withdrawn submission cannot be reopened by the learner');

-- ---- Marcus and his review ---------------------------------------------------
select tests.as_user(tests.uid('marcus'));
select is((select count(*)::int from public.reviews where id = tests.marcus_review()), 1, 'Marcus reads the review of his submission');
select throws_ok(
  $$ update public.reviews set feedback = 'Perfect, no notes.' where id = tests.marcus_review() $$,
  '42501', null, 'Marcus cannot edit review feedback');
select throws_ok(
  $$ update public.reviews set rating = 'strong' where id = tests.marcus_review() $$,
  '42501', null, 'Marcus cannot edit the rating');
select lives_ok(
  $$ update public.reviews set learner_seen_at = now() where id = tests.marcus_review() $$,
  'Marcus can mark the review seen');
select throws_ok(
  $$ insert into public.reviews (submission_id, trainer_id, feedback) values (tests.marcus_submission(), tests.uid('marcus'), 'Great job, me') $$,
  '42501', null, 'Marcus cannot review his own submission');

select tests.as_postgres();
select ok(
  (select learner_seen_at is not null and updated_at = created_at from public.reviews where id = tests.marcus_review()),
  'learner_seen_at is set and did not bump updated_at');

-- ---- Amanda vs Marcus's review; leaving a cohort -------------------------------
select tests.as_user(tests.uid('amanda'));
select results_eq(
  $$ with u as (update public.reviews set learner_seen_at = null where id = tests.marcus_review() returning 1)
     select count(*)::int from u $$,
  array[0], 'Amanda cannot touch Marcus''s review');
select results_eq(
  $$ with d as (delete from public.cohort_members where user_id = tests.uid('jordan') returning 1)
     select count(*)::int from d $$,
  array[0], 'Amanda cannot remove another member');
select results_eq(
  $$ with d as (delete from public.cohort_members where user_id = tests.uid('amanda') returning 1)
     select count(*)::int from d $$,
  array[1], 'Amanda can leave her cohort');

select * from finish();
rollback;
