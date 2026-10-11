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

-- Schema-level guarantees: RLS everywhere, private schema closed, definer functions pinned.
select plan(17);

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'),
  10, 'public has the 10 spec tables');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'RLS is enabled on every public table');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
        or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))),
  0, 'anon has no privileges on any public table');

select ok(
  not has_table_privilege('authenticated', 'app_private.trainer_codes', 'select')
  and not has_table_privilege('authenticated', 'app_private.trainer_codes', 'insert')
  and not has_table_privilege('authenticated', 'app_private.trainer_codes', 'update'),
  'authenticated cannot touch app_private.trainer_codes');

select ok(
  not has_table_privilege('anon', 'app_private.trainer_codes', 'select')
  and not has_table_privilege('anon', 'app_private.trainer_code_claims', 'select'),
  'anon cannot read the private trainer tables');

select ok(not has_schema_privilege('anon', 'app_private', 'usage'), 'anon has no usage on app_private');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private') and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""'], false)),
  0, 'every security definer function sets search_path = ''''');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')
      and not coalesce(p.proconfig @> array['search_path=""'], false)),
  0, 'every function we own sets search_path = ''''');

select is(
  (select count(*)::int from unnest(array[
      'public.join_cohort(text)', 'public.claim_trainer(text)', 'public.create_cohort(text, date)',
      'public.rotate_join_code(uuid)', 'public.assignment_progress(uuid)', 'public.cohort_member_stats(uuid)'
    ]) f where has_function_privilege('anon', f, 'execute')),
  0, 'anon cannot execute any RPC');

select is(
  (select count(*)::int from unnest(array[
      'public.join_cohort(text)', 'public.claim_trainer(text)', 'public.create_cohort(text, date)',
      'public.rotate_join_code(uuid)', 'public.assignment_progress(uuid)', 'public.cohort_member_stats(uuid)'
    ]) f where has_function_privilege('authenticated', f, 'execute')),
  6, 'authenticated can execute every RPC');

select ok(
  not has_function_privilege('authenticated', 'app_private.handle_new_user()', 'execute')
  and not has_function_privilege('authenticated', 'app_private.generate_join_code()', 'execute')
  and not has_function_privilege('authenticated', 'app_private.reviews_after_insert()', 'execute'),
  'internal functions are not executable by authenticated');

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'can_train', 'update')
  and has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update')
  and not has_table_privilege('authenticated', 'public.profiles', 'insert'),
  'profiles: only display_name is client-writable');

select ok(
  not has_table_privilege('authenticated', 'public.cohort_members', 'insert')
  and not has_column_privilege('authenticated', 'public.cohort_members', 'role', 'update'),
  'cohort_members: no client insert, role never client-writable');

select ok(
  not has_column_privilege('authenticated', 'public.cohorts', 'join_code', 'update')
  and not has_column_privilege('authenticated', 'public.cohorts', 'trainer_id', 'update')
  and not has_table_privilege('authenticated', 'public.cohorts', 'insert'),
  'cohorts: join_code/trainer_id not client-writable; created only via create_cohort');

select ok(
  not has_column_privilege('authenticated', 'public.submissions', 'reviewed_at', 'update')
  and not has_column_privilege('authenticated', 'public.submissions', 'status', 'insert'),
  'submissions: reviewed_at and initial status are server-controlled');

select ok(
  exists (select 1 from storage.buckets where id = 'review-audio' and not public),
  'review-audio bucket exists and is private');

select is(
  (select count(*)::int from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'),
  1, 'auth.users has the profile trigger');

select * from finish();
rollback;
