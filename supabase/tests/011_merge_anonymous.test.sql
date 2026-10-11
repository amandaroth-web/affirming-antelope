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

-- merge_anonymous_user: a guest signs in to an existing account and brings their practice.
select plan(31);

select tests.as_postgres();
insert into tests.ids values
  ('anon1', tests.create_anon_user()),
  ('anon2', tests.create_anon_user()),
  ('fresh', tests.create_user('fresh@example.com')),
  ('dup_client', gen_random_uuid()),
  ('new_client', gen_random_uuid()),
  ('session_client', gen_random_uuid());

-- anon1: progress that overlaps Amanda's (seed) in every interesting way
insert into public.learner_state (user_id, state, version) values (tests.id('anon1'), $json${
  "firstName": "Sam", "role": "", "pathwayId": "mi-for-leaders", "currentWeek": 6,
  "completedActivityIds": ["u04-a3", "u05-a1"],
  "skills": {
    "oars": {"level": 1, "percent": 10, "status": "in-progress"},
    "evoking": {"level": 2, "percent": 5, "status": "in-progress"},
    "discord": {"level": 1, "percent": 20, "status": "in-progress"}
  },
  "weekDays": [false, true, false, false, false, false, true],
  "streak": {"days": 2, "lastPracticeDay": "2026-10-10"},
  "weeklyGoal": {"target": 3, "done": 4, "hitCount": 1},
  "scenariosCompleted": 1, "pathSeenWeek": 6
}$json$, 3);
insert into public.activity_completions (user_id, client_id, kind, ref_id) values
  (tests.uid('amanda'), tests.id('dup_client'), 'drill', 'oars-1'),
  (tests.id('anon1'), tests.id('dup_client'), 'drill', 'oars-1'),
  (tests.id('anon1'), tests.id('new_client'), 'drill', 'oars-2');
insert into public.practice_sessions (user_id, client_id, kind, ref_id)
  values (tests.id('anon1'), tests.id('session_client'), 'drill', 'oars-2');
insert into app_private.ai_usage (user_id, day, bucket, count) values
  (tests.uid('amanda'), (now() at time zone 'utc')::date, 'turn', 10),
  (tests.id('anon1'), (now() at time zone 'utc')::date, 'turn', 7),
  (tests.id('anon1'), (now() at time zone 'utc')::date, 'drill', 2);

-- anon2: a named guest whose account has no learner_state yet
insert into public.learner_state (user_id, state, version) values (tests.id('anon2'), '{"firstName":"Lee","currentWeek":2}', 4);
update public.profiles set display_name = 'Lee' where id = tests.id('anon2');

-- ---------------------------------------------------------------- access
select ok(not has_function_privilege('authenticated', 'public.merge_anonymous_user(uuid, uuid)', 'execute')
          and not has_function_privilege('anon', 'public.merge_anonymous_user(uuid, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.merge_anonymous_user(uuid, uuid)', 'execute'),
  'merge_anonymous_user is service-role only');

-- ---------------------------------------------------------------- refusals
select tests.as_service_role();
select throws_ok($$ select public.merge_anonymous_user(tests.uid('jordan'), tests.uid('amanda')) $$,
  'PT409', 'That user is not anonymous', 'refuses a permanent user as the source');
select throws_ok($$ select public.merge_anonymous_user(tests.id('anon1'), tests.id('anon2')) $$,
  'PT409', 'The target account is anonymous', 'refuses an anonymous target');
select throws_ok($$ select public.merge_anonymous_user(tests.id('anon1'), tests.id('anon1')) $$,
  '22023', null, 'refuses merging into itself');
select throws_ok($$ select public.merge_anonymous_user(gen_random_uuid(), tests.uid('amanda')) $$,
  'PT404', null, 'refuses an unknown source');

-- ---------------------------------------------------------------- merge into an account with state
select is(public.merge_anonymous_user(tests.id('anon1'), tests.uid('amanda')),
  '{"learner_state": "merged", "completions_moved": 1, "sessions_moved": 1}'::jsonb,
  'merges anon1 into Amanda');

select tests.as_postgres();
select is((select version from public.learner_state where user_id = tests.uid('amanda')), 2, 'account version bumps');
select is((select count(*)::int from public.learner_state where user_id = tests.id('anon1')), 0, 'guest learner_state is gone');
select is((select state->>'firstName' from public.learner_state where user_id = tests.uid('amanda')), 'Amanda',
  'identity: the account''s name wins');
select is((select state->>'role' from public.learner_state where user_id = tests.uid('amanda')), 'Director of outpatient nursing',
  'identity: the account''s role wins over an empty one');
select is((select (state->>'currentWeek')::int from public.learner_state where user_id = tests.uid('amanda')), 6,
  'currentWeek: max');
select is((select state->'completedActivityIds' from public.learner_state where user_id = tests.uid('amanda')),
  '["u04-a1", "u04-a2", "u04-a3", "u05-a1"]'::jsonb, 'completedActivityIds: union, account first');
select is((select state->'skills'->'oars' from public.learner_state where user_id = tests.uid('amanda')),
  '{"level": 2, "percent": 100, "status": "complete"}'::jsonb, 'skills: the account''s higher rank stays');
select is((select state->'skills'->'evoking' from public.learner_state where user_id = tests.uid('amanda')),
  '{"level": 2, "percent": 5, "status": "in-progress"}'::jsonb, 'skills: the guest''s higher level wins');
select is((select state->'skills'->'discord' from public.learner_state where user_id = tests.uid('amanda')),
  '{"level": 1, "percent": 20, "status": "in-progress"}'::jsonb, 'skills: unlocked beats locked');
select is((select state->'skills'->'engaging' from public.learner_state where user_id = tests.uid('amanda')),
  '{"level": 3, "percent": 40, "status": "in-progress"}'::jsonb, 'skills: account-only skills are kept');
select is((select state->'weekDays' from public.learner_state where user_id = tests.uid('amanda')),
  '[true, true, true, true, false, false, true]'::jsonb, 'weekDays: OR');
select is((select state->'streak' from public.learner_state where user_id = tests.uid('amanda')),
  '{"days": 2, "lastPracticeDay": "2026-10-10"}'::jsonb, 'streak: the later practice day wins');
select is((select state->'weeklyGoal' from public.learner_state where user_id = tests.uid('amanda')),
  '{"target": 5, "done": 4, "hitCount": 2}'::jsonb, 'weeklyGoal: account target, max counts');
select is((select (state->>'scenariosCompleted')::int from public.learner_state where user_id = tests.uid('amanda')), 4,
  'scenariosCompleted: max');
select is((select state->'settings' from public.learner_state where user_id = tests.uid('amanda')),
  '{"motion": "system", "haptics": true}'::jsonb, 'unknown keys survive');

select is((select count(*)::int from public.activity_completions where user_id = tests.uid('amanda') and client_id = tests.id('new_client')), 1,
  'completion moved to the account');
select is((select count(*)::int from public.activity_completions where user_id = tests.uid('amanda') and client_id = tests.id('dup_client')), 1,
  'duplicate completion not doubled');
select is((select count from app_private.ai_usage where user_id = tests.uid('amanda') and bucket = 'turn'), 17,
  'today''s AI usage follows the person');

select tests.as_user(tests.uid('amanda'));
select is((select count(*)::int from public.practice_sessions where client_id = tests.id('session_client')), 1,
  'the account sees the moved session');

-- the route then deletes the anonymous user: leftovers cascade away
select tests.as_postgres();
delete from auth.users where id = tests.id('anon1');
select is((select count(*)::int from public.activity_completions where client_id = tests.id('dup_client')), 1,
  'deleting the anonymous user removes its leftover duplicate');
select is((select count(*)::int from app_private.ai_usage where user_id = tests.id('anon1')), 0,
  'and its counters');

-- ---------------------------------------------------------------- merge into an account without state
select tests.as_service_role();
select is(public.merge_anonymous_user(tests.id('anon2'), tests.id('fresh')),
  '{"learner_state": "moved", "completions_moved": 0, "sessions_moved": 0}'::jsonb,
  'merges anon2 into a fresh account');
select tests.as_postgres();
select is((select version from public.learner_state where user_id = tests.id('fresh')), 5,
  'moved learner_state version rises');
select is((select state->>'firstName' from public.learner_state where user_id = tests.id('fresh')), 'Lee',
  'moved learner_state is the guest''s');
select is((select display_name from public.profiles where id = tests.id('fresh')), 'Lee',
  'a chosen guest name fills an account that never chose one');

select * from finish();
rollback;
