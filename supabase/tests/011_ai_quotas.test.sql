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

-- Durable AI quotas: consume_ai_quota(bucket) and the legacy per-IP variant.
-- now() is fixed for the whole transaction, so every call lands in the same minute.
select plan(29);

select tests.as_postgres();
insert into tests.ids values ('anon', tests.create_anon_user());

-- ---------------------------------------------------------------- access
select ok(not has_function_privilege('anon', 'public.consume_ai_quota(text)', 'execute'),
  'anon role cannot consume quota');
select ok(has_function_privilege('authenticated', 'public.consume_ai_quota(text)', 'execute'),
  'signed-in users (anonymous or permanent) can consume their own quota');
select ok(not has_function_privilege('authenticated', 'public.consume_legacy_ai_quota(text, text)', 'execute')
          and has_function_privilege('service_role', 'public.consume_legacy_ai_quota(text, text)', 'execute'),
  'legacy per-IP quota is service-role only');
select ok(not has_table_privilege('authenticated', 'app_private.ai_usage', 'select')
          and not has_table_privilege('authenticated', 'app_private.ai_quota_limits', 'update')
          and not has_table_privilege('service_role', 'app_private.ai_usage', 'update'),
  'quota tables are not reachable through the API');

-- ---------------------------------------------------------------- anonymous tier
select tests.as_anon_user(tests.id('anon'));
select is(public.consume_ai_quota('turn'),
  '{"allowed": true, "reason": null, "limit": 60, "remaining": 59, "retry_after": 0}'::jsonb,
  'anonymous turn: first call allowed, 59 left of 60');
select is((public.consume_ai_quota('turn')->>'remaining')::int, 58, 'the counter decrements');
select throws_ok($$ select public.consume_ai_quota('essay') $$, '22023', null, 'unknown bucket is rejected');

do $$ begin for i in 1..10 loop perform public.consume_ai_quota('turn'); end loop; end $$;
select is(public.consume_ai_quota('turn')->>'reason', 'burst', 'anonymous turn: 13th call in a minute hits the burst guard');
select ok((public.consume_ai_quota('turn')->>'retry_after')::int between 1 and 60, 'burst retry_after is under a minute');
select is((public.consume_ai_quota('turn')->>'remaining')::int, 48, 'denied calls are not counted');

select is((public.consume_ai_quota('debrief')->>'limit')::int, 6, 'anonymous debrief limit is 6');
select is((public.consume_ai_quota('drill')->>'limit')::int, 40, 'anonymous drill limit is 40');

-- daily limit (pretend the minute window has passed)
select tests.as_postgres();
update app_private.ai_usage set count = 60, minute_count = 0 where user_id = tests.id('anon') and bucket = 'turn';
select tests.as_anon_user(tests.id('anon'));
select is(public.consume_ai_quota('turn')->>'reason', 'daily', 'anonymous turn: 61st call of the day is refused');
select ok((public.consume_ai_quota('turn')->>'retry_after')::int between 1 and 86400, 'daily retry_after is until UTC midnight');
select is((public.consume_ai_quota('turn')->>'remaining')::int, 0, 'nothing remaining');

-- ---------------------------------------------------------------- permanent tier
select tests.as_user(tests.uid('amanda'));
select is((public.consume_ai_quota('turn')->>'limit')::int, 300, 'permanent turn limit is 300');
select is((public.consume_ai_quota('debrief')->>'limit')::int, 30, 'permanent debrief limit is 30');
select is((public.consume_ai_quota('drill')->>'remaining')::int, 199, 'permanent drill: 199 left of 200');
select is((public.consume_ai_quota('turn')->>'remaining')::int, 298, 'permanent counter is separate from the anonymous one');

-- a token without the claim gets the lower tier
select tests.as_postgres();
select set_config('request.jwt.claims', json_build_object('sub', tests.uid('jordan'), 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select is((public.consume_ai_quota('turn')->>'limit')::int, 60, 'a JWT without is_anonymous gets anonymous limits');

-- ---------------------------------------------------------------- global circuit breaker
select tests.as_postgres();
update app_private.ai_global_limits g set per_day = u.count
  from app_private.ai_usage_global u
 where g.bucket = 'debrief' and u.bucket = 'debrief' and u.day = (now() at time zone 'utc')::date;
select tests.as_user(tests.uid('priya'));
select is(public.consume_ai_quota('debrief')->>'reason', 'global', 'over the global debrief ceiling: refused');
select is((public.consume_ai_quota('turn')->>'allowed')::boolean, true, 'other buckets keep working');
select tests.as_postgres();
select is((select count from app_private.ai_usage where user_id = tests.uid('priya') and bucket = 'debrief'), 0,
  'a breaker refusal is not charged to the caller');
update app_private.ai_global_limits set per_day = null where bucket = 'debrief';
select tests.as_user(tests.uid('priya'));
select is((public.consume_ai_quota('debrief')->>'allowed')::boolean, true, 'no ceiling: allowed again');

-- ---------------------------------------------------------------- legacy per-IP
-- ---------------------------------------------------------------- deleted / banned users
select tests.as_postgres();
insert into tests.ids values ('gone', tests.create_anon_user()), ('banned', tests.create_anon_user());
update auth.users set banned_until = now() + interval '1 day' where id = tests.id('banned');
delete from auth.users where id = tests.id('gone');
select tests.as_anon_user(tests.id('gone'));
select throws_ok($$ select public.consume_ai_quota('turn') $$, '42501', 'This session has ended. Sign in again.',
  'a deleted user''s still-valid JWT gets no quota');
select tests.as_anon_user(tests.id('banned'));
select throws_ok($$ select public.consume_ai_quota('turn') $$, '42501', null, 'a banned user gets no quota');

select tests.as_service_role();
select is((public.consume_legacy_ai_quota('ip-hash-0123456789abcdef', 'debrief')->>'limit')::int, 3,
  'legacy debrief limit is 3 per IP');
select is(public.consume_legacy_ai_quota('ip-hash-0123456789abcdef', 'debrief')->>'reason', 'burst',
  'legacy debrief: 1 per minute');
select throws_ok($$ select public.consume_legacy_ai_quota('short', 'turn') $$, '22023', null, 'legacy needs an ip hash');

select * from finish();
rollback;
