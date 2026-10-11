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

-- Trainers see a session only after it's submitted to a cohort they train.
-- A trainer of another cohort sees nothing.
select plan(37);

-- Fixtures: a second trainer with their own cohort and learner, plus a fresh
-- submitted session from Jordan in Rosa's cohort.
select tests.as_postgres();
do $$
declare
  t uuid := tests.create_user('other.trainer@example.com', 'Other Trainer');
  l uuid := tests.create_user('outsider@example.com', 'Outsider');
begin
  update public.profiles set can_train = true where id = t;
  insert into public.cohorts (id, name, trainer_id, join_code)
  values ('c0c0c0c0-0000-4000-8000-0000000000b2', 'Other cohort', t, 'MIL-ZZZ9');
  insert into public.cohort_members (cohort_id, user_id, role) values
    ('c0c0c0c0-0000-4000-8000-0000000000b2', t, 'trainer'),
    ('c0c0c0c0-0000-4000-8000-0000000000b2', l, 'learner');
  insert into public.practice_sessions (id, user_id, client_id, kind, ref_id)
  values ('5e5e5e5e-0000-4000-8000-0000000000b2', l, gen_random_uuid(), 'roleplay', 'PM-017');
  insert into public.submissions (id, session_id, user_id, cohort_id)
  values ('5b5b5b5b-0000-4000-8000-0000000000b2', '5e5e5e5e-0000-4000-8000-0000000000b2', l, 'c0c0c0c0-0000-4000-8000-0000000000b2');

  insert into public.practice_sessions (id, user_id, client_id, kind, ref_id)
  values ('5e5e5e5e-0000-4000-8000-0000000000f2', tests.uid('jordan'), gen_random_uuid(), 'roleplay', 'EN-003');
  insert into public.submissions (id, session_id, user_id, cohort_id)
  values ('5b5b5b5b-0000-4000-8000-0000000000f2', '5e5e5e5e-0000-4000-8000-0000000000f2', tests.uid('jordan'), tests.cohort());
end $$;

create or replace function tests.other_trainer() returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where email = 'other.trainer@example.com'
$$;
grant execute on function tests.other_trainer() to authenticated;

-- ---- Rosa -------------------------------------------------------------------
select tests.as_user(tests.uid('rosa'));

select is((select count(*)::int from public.practice_sessions where id = tests.amanda_roleplay()), 1,
  'Rosa reads Amanda''s submitted PM-017 session');
select is((select jsonb_array_length(transcript) from public.practice_sessions where id = tests.amanda_roleplay()), 15,
  'Rosa sees the full transcript of the submitted session');
select is((select count(*)::int from public.practice_sessions where id = tests.amanda_drill()), 0,
  'Rosa cannot read Amanda''s unsubmitted drill session');
select is((select count(*)::int from public.practice_sessions where user_id = tests.uid('amanda')), 1,
  'Rosa sees exactly one of Amanda''s sessions');
select is((select count(*)::int from public.practice_sessions where id = '5e5e5e5e-0000-4000-8000-0000000000b2'), 0,
  'Rosa cannot read a session submitted to another cohort');
select is((select count(*)::int from public.activity_completions), 0, 'Rosa cannot read completions directly');
select is((select count(*)::int from public.learner_state), 0, 'Rosa cannot read learner_state');
select is((select count(*)::int from public.submissions where cohort_id = tests.cohort()), 3,
  'Rosa reads the submissions in her cohort');
select is((select count(*)::int from public.submissions where id = '5b5b5b5b-0000-4000-8000-0000000000b2'), 0,
  'Rosa cannot read another cohort''s submission');
select is((select count(*)::int from public.profiles), 5, 'Rosa reads her own and her 4 learners'' profiles');
select is((select count(*)::int from public.profiles where id = tests.other_trainer()), 0,
  'Rosa cannot read a profile outside her cohorts');
select is((select count(*)::int from public.cohort_members), 5, 'Rosa reads her cohort''s roster');

-- Reviewing
select lives_ok(
  $$ insert into public.reviews (submission_id, feedback, rating, recommended_kind, recommended_ref)
     values (tests.amanda_submission(), 'Nice recovery at t14.', 'developing', 'drill', 'drill-evoking-04') $$,
  'Rosa reviews Amanda''s submission');
select results_eq(
  $$ select status, reviewed_at is not null from public.submissions where id = tests.amanda_submission() $$,
  $$ values ('reviewed'::text, true) $$,
  'saving the review moves the submission to reviewed');
select throws_ok(
  $$ insert into public.reviews (submission_id, feedback) values ('5b5b5b5b-0000-4000-8000-0000000000b2', 'Hi') $$,
  '42501', null, 'Rosa cannot review a submission in another cohort');
select throws_ok(
  $$ insert into public.reviews (submission_id, trainer_id, feedback) values ('5b5b5b5b-0000-4000-8000-0000000000f2', tests.other_trainer(), 'Hi') $$,
  '42501', null, 'Rosa cannot write a review as another trainer');
select lives_ok(
  $$ update public.reviews set feedback = 'Nice recovery at t14. Try an evoking question at t12.' where submission_id = tests.amanda_submission() $$,
  'Rosa edits her own review');
select throws_ok(
  $$ update public.reviews set learner_seen_at = now() where submission_id = tests.amanda_submission() $$,
  '42501', null, 'Rosa cannot set learner_seen_at');
select results_eq(
  $$ with u as (update public.submissions set status = 'withdrawn' where id = '5b5b5b5b-0000-4000-8000-0000000000f2' returning 1)
     select count(*)::int from u $$,
  array[0], 'Rosa cannot change a learner''s submission');
select results_eq(
  $$ with u as (update public.practice_sessions set transcript = '[]' where id = tests.amanda_roleplay() returning 1)
     select count(*)::int from u $$,
  array[0], 'Rosa cannot edit a submitted session');

-- Withdrawal hides the session again
select is((select count(*)::int from public.practice_sessions where id = '5e5e5e5e-0000-4000-8000-0000000000f2'), 1,
  'Rosa sees Jordan''s newly submitted session');
select tests.as_user(tests.uid('jordan'));
update public.submissions set status = 'withdrawn' where id = '5b5b5b5b-0000-4000-8000-0000000000f2';
select tests.as_user(tests.uid('rosa'));
select is((select count(*)::int from public.practice_sessions where id = '5e5e5e5e-0000-4000-8000-0000000000f2'), 0,
  'after withdrawal Rosa can no longer read the session');
select is((select count(*)::int from public.submissions where id = '5b5b5b5b-0000-4000-8000-0000000000f2'), 0,
  'after withdrawal Rosa can no longer read the submission');
select throws_ok(
  $$ insert into public.reviews (submission_id, feedback) values ('5b5b5b5b-0000-4000-8000-0000000000f2', 'Late review') $$,
  '42501', null, 'Rosa cannot review a withdrawn submission');

-- Managing the cohort
select lives_ok(
  $$ insert into public.assignments (id, cohort_id, title) values ('a5a5a5a5-0000-4000-8000-0000000000f3', tests.cohort(), 'Week 6') $$,
  'Rosa creates an assignment');
select lives_ok(
  $$ insert into public.assignment_items (assignment_id, kind, ref_id) values ('a5a5a5a5-0000-4000-8000-0000000000f3', 'roleplay', 'PM-017') $$,
  'Rosa adds an item to it');
select results_eq(
  $$ with d as (delete from public.cohort_members where cohort_id = tests.cohort() and user_id = tests.uid('rosa') returning 1)
     select count(*)::int from d $$,
  array[0], 'the trainer membership cannot be deleted');
select results_eq(
  $$ with d as (delete from public.cohort_members where cohort_id = tests.cohort() and user_id = tests.uid('priya') returning 1)
     select count(*)::int from d $$,
  array[1], 'Rosa can remove a learner from her cohort');

-- ---- A trainer of a different cohort -------------------------------------------
select tests.as_user(tests.other_trainer());

select is((select count(*)::int from public.cohorts where id = tests.cohort()), 0, 'other trainer cannot see Rosa''s cohort');
select is((select count(*)::int from public.practice_sessions), 1, 'other trainer sees only their own learner''s submitted session');
select is((select count(*)::int from public.submissions where cohort_id = tests.cohort()), 0, 'other trainer sees no submissions from Rosa''s cohort');
select is((select count(*)::int from public.reviews), 0, 'other trainer sees no reviews');
select is((select count(*)::int from public.cohort_members where cohort_id = tests.cohort()), 0, 'other trainer cannot read Rosa''s roster');
select is((select count(*)::int from public.profiles where id in (tests.uid('amanda'), tests.uid('rosa'))), 0, 'other trainer cannot read Rosa''s people');
select is((select count(*)::int from public.assignments where cohort_id = tests.cohort()), 0, 'other trainer cannot read Rosa''s assignments');
select throws_ok(
  $$ insert into public.assignments (cohort_id, title) values (tests.cohort(), 'Sneaky') $$,
  '42501', null, 'other trainer cannot add assignments to Rosa''s cohort');
select results_eq(
  $$ with u as (update public.cohorts set name = 'Mine now' where id = tests.cohort() returning 1) select count(*)::int from u $$,
  array[0], 'other trainer cannot rename Rosa''s cohort');

select * from finish();
rollback;
