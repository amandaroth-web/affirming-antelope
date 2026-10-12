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

-- Voice buckets (stt, tts) on the shared consume_ai_quota: limits per tier, the burst
-- guard, the daily limit, the global circuit breaker, and the legacy tier's absence.
-- now() is fixed for the whole transaction, so every call lands in the same minute.
select plan(24);

select tests.as_postgres();
insert into tests.ids values ('anon', tests.create_anon_user());

-- ---------------------------------------------------------------- config
select is((select count(*)::int from app_private.ai_quota_limits where bucket in ('stt', 'tts')), 4,
  'stt and tts have limits for anonymous and permanent, and none for legacy_ip');
select is((select count(*)::int from app_private.ai_global_limits where bucket in ('stt', 'tts') and per_day is not null), 2,
  'stt and tts have a global ceiling');
select ok((select per_day from app_private.ai_quota_limits where tier = 'anonymous' and bucket = 'stt')
        < (select per_day from app_private.ai_quota_limits where tier = 'permanent' and bucket = 'stt')
      and (select per_day from app_private.ai_quota_limits where tier = 'anonymous' and bucket = 'tts')
        < (select per_day from app_private.ai_quota_limits where tier = 'permanent' and bucket = 'tts'),
  'anonymous voice limits are lower than permanent ones');
select throws_ok(
  $$ select public.consume_legacy_ai_quota('ip-hash-0123456789abcdef', 'stt') $$, '22023', null,
  'the legacy per-IP tier has no voice buckets');
select throws_ok(
  $$ insert into app_private.ai_quota_limits values ('anonymous', 'video', 1, 1) $$, '23514', null,
  'a bucket outside the allowed set is still rejected');
select lives_ok(
  $$ insert into app_private.ai_usage_global (day, bucket) values ('2000-01-01', 'stt') $$,
  'usage counters accept the voice buckets');

-- ---------------------------------------------------------------- anonymous tier
select tests.as_anon_user(tests.id('anon'));
select is(public.consume_ai_quota('stt'),
  '{"allowed": true, "reason": null, "limit": 60, "remaining": 59, "retry_after": 0}'::jsonb,
  'anonymous stt: first call allowed, 59 left of 60');
select is((public.consume_ai_quota('tts')->>'limit')::int, 200, 'anonymous tts limit is 200');
select is((public.consume_ai_quota('tts')->>'remaining')::int, 198, 'tts counts separately from stt');
select is((public.consume_ai_quota('turn')->>'limit')::int, 60, 'turn quota is untouched by voice');

-- stt burst: 8 a minute (1 already used above)
do $$ begin for i in 1..7 loop perform public.consume_ai_quota('stt'); end loop; end $$;
select is(public.consume_ai_quota('stt')->>'reason', 'burst', 'anonymous stt: 9th call in a minute hits the burst guard');
select ok((public.consume_ai_quota('stt')->>'retry_after')::int between 1 and 60, 'burst retry_after is under a minute');
select is((public.consume_ai_quota('stt')->>'remaining')::int, 52, 'denied calls are not counted');

-- tts burst: 30 a minute (2 used above)
do $$ begin for i in 1..28 loop perform public.consume_ai_quota('tts'); end loop; end $$;
select is(public.consume_ai_quota('tts')->>'reason', 'burst', 'anonymous tts: 31st call in a minute hits the burst guard');

-- daily limits (pretend the minute window has passed)
select tests.as_postgres();
update app_private.ai_usage set count = 60, minute_count = 0 where user_id = tests.id('anon') and bucket = 'stt';
update app_private.ai_usage set count = 200, minute_count = 0 where user_id = tests.id('anon') and bucket = 'tts';
select tests.as_anon_user(tests.id('anon'));
select is(public.consume_ai_quota('stt')->>'reason', 'daily', 'anonymous stt: 61st call of the day is refused');
select is(public.consume_ai_quota('tts')->>'reason', 'daily', 'anonymous tts: 201st call of the day is refused');
select ok((public.consume_ai_quota('tts')->>'retry_after')::int between 1 and 86400, 'daily retry_after is until UTC midnight');

-- ---------------------------------------------------------------- permanent tier
select tests.as_user(tests.uid('amanda'));
select is((public.consume_ai_quota('stt')->>'limit')::int, 300, 'permanent stt limit is 300');
select is((public.consume_ai_quota('tts')->>'limit')::int, 1000, 'permanent tts limit is 1000');
select is((public.consume_ai_quota('tts')->>'remaining')::int, 998, 'permanent counters are separate from the anonymous ones');
do $$ begin for i in 1..14 loop perform public.consume_ai_quota('stt'); end loop; end $$;
select is(public.consume_ai_quota('stt')->>'reason', 'burst', 'permanent stt: 16th call in a minute hits the burst guard');

-- ---------------------------------------------------------------- global circuit breaker
select tests.as_postgres();
update app_private.ai_global_limits g set per_day = u.count
  from app_private.ai_usage_global u
 where g.bucket = 'tts' and u.bucket = 'tts' and u.day = (now() at time zone 'utc')::date;
select tests.as_user(tests.uid('priya'));
select is(public.consume_ai_quota('tts')->>'reason', 'global', 'over the global tts ceiling: refused');
select is((public.consume_ai_quota('stt')->>'allowed')::boolean, true, 'the stt bucket keeps working when tts is tripped');
select tests.as_postgres();
select is((select count from app_private.ai_usage where user_id = tests.uid('priya') and bucket = 'tts'), 0,
  'a breaker refusal is not charged to the caller');

select * from finish();
rollback;
