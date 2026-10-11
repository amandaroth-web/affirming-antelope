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

-- anon sees nothing and can call nothing.
select plan(17);

select tests.as_postgres();
insert into storage.objects (bucket_id, name)
values ('review-audio', 'c0c0c0c0-0000-4000-8000-000000000001/5b5b5b5b-0000-4000-8000-000000000002/0e0e0e0e-0000-4000-8000-000000000009.m4a');

select tests.as_anon();

select throws_ok('select * from public.profiles', '42501', null, 'anon: profiles');
select throws_ok('select * from public.cohorts', '42501', null, 'anon: cohorts');
select throws_ok('select * from public.cohort_members', '42501', null, 'anon: cohort_members');
select throws_ok('select * from public.learner_state', '42501', null, 'anon: learner_state');
select throws_ok('select * from public.activity_completions', '42501', null, 'anon: activity_completions');
select throws_ok('select * from public.practice_sessions', '42501', null, 'anon: practice_sessions');
select throws_ok('select * from public.submissions', '42501', null, 'anon: submissions');
select throws_ok('select * from public.reviews', '42501', null, 'anon: reviews');
select throws_ok('select * from public.assignments', '42501', null, 'anon: assignments');
select throws_ok('select * from public.assignment_items', '42501', null, 'anon: assignment_items');
select throws_ok($$ insert into public.practice_sessions (user_id, client_id, kind, ref_id)
                    values (tests.uid('amanda'), gen_random_uuid(), 'drill', 'x') $$, '42501', null, 'anon: cannot insert');
select throws_ok($$ select public.join_cohort('MIL-DEMO') $$, '42501', null, 'anon: join_cohort');
select throws_ok($$ select public.claim_trainer('TRAIN-PILOT') $$, '42501', null, 'anon: claim_trainer');
select throws_ok($$ select public.create_cohort('x', null) $$, '42501', null, 'anon: create_cohort');
select throws_ok($$ select * from public.assignment_progress(tests.assignment()) $$, '42501', null, 'anon: assignment_progress');
select throws_ok($$ select * from public.cohort_member_stats(tests.cohort()) $$, '42501', null, 'anon: cohort_member_stats');
select is((select count(*)::int from storage.objects where bucket_id = 'review-audio'), 0, 'anon: no review audio');

select * from finish();
rollback;
