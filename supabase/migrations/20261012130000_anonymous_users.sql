-- Anonymous users (supabase.auth.signInAnonymously). Every app user is a Supabase
-- user from first launch; guests are anonymous. Design: docs/anonymous-auth.md.
--
-- Anonymous users get the `authenticated` role, so every existing `to authenticated`
-- policy already applies to them. They are told apart by the `is_anonymous` JWT
-- claim. The rule:
--
--   allowed      their own learner_state, activity_completions, practice_sessions,
--                and their own profile (read, rename)
--   not allowed  cohorts, cohort membership, submissions, reviews, assignments,
--                review audio, trainer codes, other people's profiles
--
-- Review of the existing policies and RPCs (2026-10-11):
--   profiles select        own row, members of cohorts I train, my cohorts' trainers.
--                          Anonymous users train nothing and belong to nothing, so only
--                          their own row matched. Now enforced: restrictive policy.
--   profiles update        own display_name only (column grant). Kept for anonymous
--                          users: they can name themselves before converting.
--   cohorts / cohort_members / assignments / assignment_items
--                          reachable only through membership or training, which an
--                          anonymous user can't get once join_cohort/create_cohort
--                          refuse them. Restrictive policies added anyway so a future
--                          policy or RPC can't open them by accident.
--   learner_state / activity_completions / practice_sessions
--                          owner-only. Unchanged; this is what anonymous users use.
--                          (practice_sessions' trainer branch matches only submitted
--                          sessions, which anonymous users can't create.)
--   submissions insert     needed membership of the target cohort, so it already
--                          failed, but with an opaque RLS error. Now a trigger raises a
--                          clear "sign in" error first, plus a restrictive policy.
--   reviews                reachable only through a trainer's cohort or one's own
--                          submission. Restrictive policy added.
--   storage review-audio   can_access_review_audio() needs a training role or an own
--                          submission. Restrictive policy added.
--   join_cohort, claim_trainer, create_cohort
--                          only checked auth.uid(). Now refuse anonymous callers with
--                          SQLSTATE 42501, hint 'account_required'.
--   rotate_join_code       trainer of the cohort only, so already refused. Unchanged.
--   assignment_progress, cohort_member_stats
--                          return rows only to members/trainers, so an anonymous caller
--                          gets no rows. Unchanged.
--   app_private.*          helpers keyed on auth.uid(); nothing new is reachable.
--   realtime               reviews and submissions respect RLS, so the restrictive
--                          policies cover postgres_changes too.
--
-- The claim check is `(select (auth.jwt()->>'is_anonymous')::boolean) is false`, as in
-- the Supabase docs. It fails closed: a JWT without the claim counts as anonymous.
-- Supabase Auth puts the claim in every access token it issues.

-- ---------------------------------------------------------------------------
-- Restrictive policies. They AND with the existing permissive ones.
-- ---------------------------------------------------------------------------

create policy "profiles: anonymous users read only their own"
  on public.profiles as restrictive for select to authenticated
  using (
    id = (select auth.uid())
    or (select (auth.jwt()->>'is_anonymous')::boolean) is false
  );

create policy "cohorts: permanent users only"
  on public.cohorts as restrictive for all to authenticated
  using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
  with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

create policy "cohort_members: permanent users only"
  on public.cohort_members as restrictive for all to authenticated
  using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
  with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

create policy "submissions: permanent users only"
  on public.submissions as restrictive for all to authenticated
  using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
  with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

create policy "reviews: permanent users only"
  on public.reviews as restrictive for all to authenticated
  using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
  with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

create policy "assignments: permanent users only"
  on public.assignments as restrictive for all to authenticated
  using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
  with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

create policy "assignment_items: permanent users only"
  on public.assignment_items as restrictive for all to authenticated
  using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
  with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

create policy "review-audio: permanent users only"
  on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'review-audio' or (select (auth.jwt()->>'is_anonymous')::boolean) is false)
  with check (bucket_id <> 'review-audio' or (select (auth.jwt()->>'is_anonymous')::boolean) is false);

-- ---------------------------------------------------------------------------
-- Clear errors. Policies can only say "row-level security"; these say what to do.
-- ---------------------------------------------------------------------------

-- True when the caller is a signed-in anonymous user (or a JWT without the claim).
create function app_private.is_anonymous_caller()
returns boolean
language sql stable set search_path = ''
as $$
  select auth.uid() is not null
     and (select (auth.jwt()->>'is_anonymous')::boolean) is not false
$$;

revoke execute on function app_private.is_anonymous_caller() from public, anon;
grant execute on function app_private.is_anonymous_caller() to authenticated, service_role;

create function app_private.submissions_require_account()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if app_private.is_anonymous_caller() then
    raise exception 'Sign in with your email to send a session for review'
      using errcode = '42501', hint = 'account_required';
  end if;
  return new;
end;
$$;

create trigger submissions_require_account
  before insert on public.submissions
  for each row execute function app_private.submissions_require_account();

revoke execute on function app_private.submissions_require_account() from public, anon, authenticated;

-- join_cohort / claim_trainer (20261011120100_rpc.sql) and create_cohort
-- (20261012120000_cohort_pathway.sql, 3 arguments): same bodies plus the anonymous check.

create or replace function public.join_cohort(code text)
returns public.cohorts
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  normalized text;
  target public.cohorts;
begin
  if uid is null then
    raise exception 'Sign in to join a cohort' using errcode = '42501';
  end if;
  if app_private.is_anonymous_caller() then
    raise exception 'Sign in with your email to join a cohort'
      using errcode = '42501', hint = 'account_required';
  end if;

  normalized := upper(regexp_replace(coalesce(join_cohort.code, ''), '[^A-Za-z0-9]', '', 'g'));
  if normalized ~ '^MIL[A-Z0-9]{4}$' then
    normalized := 'MIL-' || substr(normalized, 4);
  elsif normalized ~ '^[A-Z0-9]{4}$' then
    normalized := 'MIL-' || normalized;
  else
    normalized := null;
  end if;

  select c.* into target
    from public.cohorts c
   where c.join_code = normalized
     and c.archived_at is null;

  if not found then
    raise exception 'That code doesn''t match an active cohort' using errcode = 'PT404';
  end if;

  insert into public.cohort_members (cohort_id, user_id, role)
  values (target.id, uid, 'learner')
  on conflict (cohort_id, user_id) do nothing;

  return target;
end;
$$;

create or replace function public.claim_trainer(code text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  normalized text := upper(btrim(coalesce(claim_trainer.code, '')));
  tc app_private.trainer_codes;
begin
  if uid is null then
    raise exception 'Sign in to claim a trainer code' using errcode = '42501';
  end if;
  if app_private.is_anonymous_caller() then
    raise exception 'Sign in with your email to claim a trainer code'
      using errcode = '42501', hint = 'account_required';
  end if;

  select t.* into tc from app_private.trainer_codes t where t.code = normalized for update;
  if not found or (tc.expires_at is not null and tc.expires_at <= now()) then
    return false;
  end if;

  if not exists (
    select 1 from app_private.trainer_code_claims cl where cl.code = tc.code and cl.user_id = uid
  ) then
    if tc.max_uses is not null and tc.uses >= tc.max_uses then
      return false;
    end if;
    insert into app_private.trainer_code_claims (code, user_id) values (tc.code, uid);
    update app_private.trainer_codes t set uses = t.uses + 1 where t.code = tc.code;
  end if;

  update public.profiles p set can_train = true where p.id = uid;
  return true;
end;
$$;

create or replace function public.create_cohort(name text, starts_on date default null, pathway_id text default 'mi-for-leaders')
returns public.cohorts
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  created public.cohorts;
begin
  if uid is null then
    raise exception 'Sign in to create a cohort' using errcode = '42501';
  end if;
  if app_private.is_anonymous_caller() then
    raise exception 'Sign in with your email to create a cohort'
      using errcode = '42501', hint = 'account_required';
  end if;
  if not exists (select 1 from public.profiles p where p.id = uid and p.can_train) then
    raise exception 'Only trainers can create cohorts' using errcode = '42501';
  end if;

  insert into public.cohorts (name, trainer_id, join_code, starts_on, pathway_id)
  values (btrim(create_cohort.name), uid, app_private.generate_join_code(), create_cohort.starts_on,
          coalesce(create_cohort.pathway_id, 'mi-for-leaders'))
  returning * into created;

  insert into public.cohort_members (cohort_id, user_id, role)
  values (created.id, uid, 'trainer')
  on conflict (cohort_id, user_id) do update set role = 'trainer';

  return created;
end;
$$;
