-- Move an anonymous user's data into an existing permanent account. Used when a
-- guest signs in to an email that already has an account (instead of converting).
-- Called by POST /api/account/merge-anonymous with the service role after it has
-- verified both access tokens; the route then deletes the anonymous auth user, which
-- cascades away anything left behind (duplicates, counters, the profile).
--
--   learner_state         when both users have one, the route merges the two documents
--                         with the app's own rules (mergeGuestIntoAccount in
--                         packages/core/src/learnerDoc.ts) and passes the result with the
--                         account version it read. A different version now means another
--                         device wrote in between: PT409, and the route re-reads and retries.
--                         When only the guest has one, it moves to the account.
--   activity_completions  moved, except client_ids the account already has
--   practice_sessions     moved, except client_ids the account already has
--   profiles.display_name copied when the guest chose a name and the account never did
--   ai_usage              the guest's counts are added to the account's, so merging
--                         doesn't reset today's quota

-- ---------------------------------------------------------------------------
-- merge_anonymous_user(anonymous_id, permanent_id, merged_state, account_version)
--   -> jsonb summary. Service role only.
-- ---------------------------------------------------------------------------

create function public.merge_anonymous_user(
  anonymous_id uuid,
  permanent_id uuid,
  merged_state jsonb default null,
  account_version integer default null
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  anon_is_anonymous boolean;
  perm_is_anonymous boolean;
  anon_state public.learner_state;
  perm_state public.learner_state;
  state_result text := 'none';
  completions_moved integer := 0;
  sessions_moved integer := 0;
  anon_profile public.profiles;
  perm_profile public.profiles;
begin
  if merge_anonymous_user.anonymous_id is null or merge_anonymous_user.permanent_id is null then
    raise exception 'anonymous_id and permanent_id are required' using errcode = '22023';
  end if;
  if merge_anonymous_user.anonymous_id = merge_anonymous_user.permanent_id then
    raise exception 'Cannot merge a user into itself' using errcode = '22023';
  end if;

  -- Lock both users (in a fixed order, so two merges can't deadlock).
  perform 1 from auth.users u
    where u.id in (merge_anonymous_user.anonymous_id, merge_anonymous_user.permanent_id)
    order by u.id for update;

  select u.is_anonymous into anon_is_anonymous from auth.users u where u.id = merge_anonymous_user.anonymous_id;
  if not found then
    raise exception 'Anonymous user not found' using errcode = 'PT404';
  end if;
  if anon_is_anonymous is not true then
    raise exception 'That user is not anonymous' using errcode = 'PT409', hint = 'not_anonymous';
  end if;

  select u.is_anonymous into perm_is_anonymous from auth.users u where u.id = merge_anonymous_user.permanent_id;
  if not found then
    raise exception 'Account not found' using errcode = 'PT404';
  end if;
  if perm_is_anonymous is not false then
    raise exception 'The target account is anonymous' using errcode = 'PT409', hint = 'not_permanent';
  end if;

  -- learner_state
  select s.* into anon_state from public.learner_state s where s.user_id = merge_anonymous_user.anonymous_id for update;
  if found then
    select s.* into perm_state from public.learner_state s where s.user_id = merge_anonymous_user.permanent_id for update;
    if found then
      if merge_anonymous_user.merged_state is null
         or jsonb_typeof(merge_anonymous_user.merged_state) <> 'object'
         or merge_anonymous_user.account_version is distinct from perm_state.version then
        raise exception 'The account''s learner_state changed; merge again' using errcode = 'PT409', hint = 'state_changed';
      end if;
      update public.learner_state s
         set state = merge_anonymous_user.merged_state,
             version = perm_state.version + 1
       where s.user_id = merge_anonymous_user.permanent_id;
      delete from public.learner_state s where s.user_id = merge_anonymous_user.anonymous_id;
      state_result := 'merged';
    else
      -- version must rise or the PT409 trigger refuses the update
      update public.learner_state s
         set user_id = merge_anonymous_user.permanent_id, version = anon_state.version + 1
       where s.user_id = merge_anonymous_user.anonymous_id;
      state_result := 'moved';
    end if;
  end if;

  -- activity_completions
  update public.activity_completions c
     set user_id = merge_anonymous_user.permanent_id
   where c.user_id = merge_anonymous_user.anonymous_id
     and not exists (
       select 1 from public.activity_completions p
        where p.user_id = merge_anonymous_user.permanent_id and p.client_id = c.client_id
     );
  get diagnostics completions_moved = row_count;

  -- practice_sessions (anonymous users can't submit, but skip any with a submission:
  -- the submission's composite FK pins the session to its owner)
  update public.practice_sessions ps
     set user_id = merge_anonymous_user.permanent_id
   where ps.user_id = merge_anonymous_user.anonymous_id
     and not exists (
       select 1 from public.practice_sessions p
        where p.user_id = merge_anonymous_user.permanent_id and p.client_id = ps.client_id
     )
     and not exists (select 1 from public.submissions s where s.session_id = ps.id);
  get diagnostics sessions_moved = row_count;

  -- display name
  select p.* into anon_profile from public.profiles p where p.id = merge_anonymous_user.anonymous_id;
  select p.* into perm_profile from public.profiles p where p.id = merge_anonymous_user.permanent_id;
  if anon_profile.display_name_set and not coalesce(perm_profile.display_name_set, true) then
    update public.profiles p set display_name = anon_profile.display_name
     where p.id = merge_anonymous_user.permanent_id;
  end if;

  -- today's (and any other day's) AI usage follows the person
  insert into app_private.ai_usage as u (user_id, day, bucket, count)
  select merge_anonymous_user.permanent_id, a.day, a.bucket, a.count
    from app_private.ai_usage a
   where a.user_id = merge_anonymous_user.anonymous_id
  on conflict (user_id, day, bucket) do update set count = u.count + excluded.count;

  return jsonb_build_object(
    'learner_state', state_result,
    'completions_moved', completions_moved,
    'sessions_moved', sessions_moved
  );
end;
$$;

revoke execute on function public.merge_anonymous_user(uuid, uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.merge_anonymous_user(uuid, uuid, jsonb, integer) to service_role;
