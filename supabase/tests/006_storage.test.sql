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

-- review-audio storage: {cohort_id}/{submission_id}/{uuid}.m4a|webm
-- Cohort trainer writes and reads; the submitting learner reads; nobody else.
select plan(15);

select tests.as_postgres();
do $$
declare t uuid := tests.create_user('other.trainer@example.com', 'Other Trainer');
begin
  update public.profiles set can_train = true where id = t;
  insert into public.cohorts (id, name, trainer_id, join_code)
  values ('c0c0c0c0-0000-4000-8000-0000000000b2', 'Other cohort', t, 'MIL-ZZZ9');
  insert into public.cohort_members (cohort_id, user_id, role)
  values ('c0c0c0c0-0000-4000-8000-0000000000b2', t, 'trainer');
  -- A withdrawn submission from Jordan in Rosa's cohort
  insert into public.practice_sessions (id, user_id, client_id, kind, ref_id)
  values ('5e5e5e5e-0000-4000-8000-0000000000f4', tests.uid('jordan'), gen_random_uuid(), 'roleplay', 'EN-003');
  insert into public.submissions (id, session_id, user_id, cohort_id, status)
  values ('5b5b5b5b-0000-4000-8000-0000000000f4', '5e5e5e5e-0000-4000-8000-0000000000f4', tests.uid('jordan'), tests.cohort(), 'withdrawn');
end $$;

create or replace function tests.other_trainer() returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where email = 'other.trainer@example.com'
$$;
-- Marcus's reviewed submission in Rosa's cohort
create or replace function tests.audio_path(file text default '0e0e0e0e-0000-4000-8000-000000000001.m4a') returns text
language sql immutable as $$
  select 'c0c0c0c0-0000-4000-8000-000000000001/5b5b5b5b-0000-4000-8000-000000000002/' || file
$$;
grant execute on all functions in schema tests to authenticated;

-- ---- Rosa uploads -------------------------------------------------------------
select tests.as_user(tests.uid('rosa'));
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('review-audio', tests.audio_path(), tests.uid('rosa')::text) $$,
  'the cohort trainer uploads review audio');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values ('review-audio', tests.audio_path('0e0e0e0e-0000-4000-8000-000000000002.webm'), tests.uid('rosa')::text) $$,
  'webm is allowed too');
select is((select count(*)::int from storage.objects where bucket_id = 'review-audio'), 2, 'the trainer reads it back');
select results_eq(
  $$ with u as (update storage.objects set metadata = '{"note":"v2"}' where bucket_id = 'review-audio' and name = tests.audio_path() returning 1)
     select count(*)::int from u $$,
  array[1], 'the trainer can replace it');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('review-audio',
       'c0c0c0c0-0000-4000-8000-0000000000b2/5b5b5b5b-0000-4000-8000-000000000002/0e0e0e0e-0000-4000-8000-000000000003.m4a') $$,
  '42501', null, 'cohort and submission in the path must match');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('review-audio', tests.audio_path('feedback.exe')) $$,
  '42501', null, 'file name must be {uuid}.m4a|webm');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('review-audio', 'c0c0c0c0-0000-4000-8000-000000000001/0e0e0e0e-0000-4000-8000-000000000004.m4a') $$,
  '42501', null, 'path must have cohort and submission folders');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('review-audio',
       'c0c0c0c0-0000-4000-8000-000000000001/5b5b5b5b-0000-4000-8000-0000000000f4/0e0e0e0e-0000-4000-8000-000000000005.m4a') $$,
  '42501', null, 'no uploads for a withdrawn submission');

-- ---- Learners ----------------------------------------------------------------
select tests.as_user(tests.uid('marcus'));
select is((select count(*)::int from storage.objects where bucket_id = 'review-audio'), 2, 'the submitting learner reads the audio');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('review-audio', tests.audio_path('0e0e0e0e-0000-4000-8000-000000000006.m4a')) $$,
  '42501', null, 'the learner cannot upload review audio');
select results_eq(
  $$ with u as (update storage.objects set metadata = '{}' where bucket_id = 'review-audio' returning 1) select count(*)::int from u $$,
  array[0], 'the learner cannot modify review audio');

select tests.as_user(tests.uid('amanda'));
select is((select count(*)::int from storage.objects where bucket_id = 'review-audio'), 0,
  'another learner in the same cohort cannot read it');

-- ---- Another cohort's trainer -------------------------------------------------
select tests.as_user(tests.other_trainer());
select is((select count(*)::int from storage.objects where bucket_id = 'review-audio'), 0,
  'a trainer of another cohort cannot read it');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('review-audio', tests.audio_path('0e0e0e0e-0000-4000-8000-000000000007.m4a')) $$,
  '42501', null, 'a trainer of another cohort cannot upload');
select results_eq(
  $$ with u as (update storage.objects set metadata = '{}' where bucket_id = 'review-audio' returning 1) select count(*)::int from u $$,
  array[0], 'a trainer of another cohort cannot modify it');

select * from finish();
rollback;
