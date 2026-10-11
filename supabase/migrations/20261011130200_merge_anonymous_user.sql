-- Move an anonymous user's data into an existing permanent account. Used when a
-- guest signs in to an email that already has an account (instead of converting).
-- Called by POST /api/account/merge-anonymous with the service role after it has
-- verified both access tokens; the route then deletes the anonymous auth user, which
-- cascades away anything left behind (duplicates, counters, the profile).
--
--   learner_state         merged with the client's PT409 rules (mergeSynced in
--                         apps/mobile/src/sync/learnerState.ts): the account is
--                         "remote", the guest is "local"
--   activity_completions  moved, except client_ids the account already has
--   practice_sessions     moved, except client_ids the account already has
--   profiles.display_name copied when the guest chose a name and the account never did
--   ai_usage              the guest's counts are added to the account's, so merging
--                         doesn't reset today's quota

-- ---------------------------------------------------------------------------
-- learner_state merge
-- ---------------------------------------------------------------------------

create function app_private.jnum(j jsonb)
returns numeric
language sql immutable set search_path = ''
as $$ select case when jsonb_typeof(j) = 'number' then (j #>> '{}')::numeric end $$;

-- JS truthiness for the values these documents hold.
create function app_private.jtruthy(j jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select case jsonb_typeof(j)
    when 'boolean' then j = 'true'::jsonb
    when 'number' then (j #>> '{}')::numeric <> 0
    when 'string' then (j #>> '{}') <> ''
    when 'array' then true
    when 'object' then true
    else false
  end
$$;

-- DemoSkillProgress rank: locked = -1, else level * 1000 + percent.
create function app_private.skill_rank(p jsonb)
returns numeric
language sql immutable set search_path = ''
as $$
  select case when p ->> 'status' = 'locked' then -1
              else coalesce(app_private.jnum(p -> 'level'), 0) * 1000 + coalesce(app_private.jnum(p -> 'percent'), 0)
         end
$$;

-- mergeSynced(local = guest, remote = account). Keys neither side has stay absent;
-- keys this function doesn't know are kept (the account's copy wins).
create function app_private.merge_learner_state(account jsonb, guest jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  g jsonb := case when jsonb_typeof(guest) = 'object' then guest else '{}'::jsonb end;
  r jsonb;     -- normalizeSynced(account, guest): the account's non-null values over the guest's
  out_doc jsonb;
  k text;
  v jsonb;
  skills jsonb;
  theirs jsonb;
  gs jsonb;
  rs jsonb;
  gday text;
  rday text;
  gw jsonb;
  rw jsonb;
begin
  select g || coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into r
    from jsonb_each(case when jsonb_typeof(account) = 'object' then account else '{}'::jsonb end) e
   where e.value <> 'null'::jsonb;
  out_doc := r;

  -- identity: the account's copy wins (remote || local)
  foreach k in array array['firstName', 'role', 'pathwayId'] loop
    v := case when app_private.jtruthy(r -> k) then r -> k else g -> k end;
    out_doc := case when v is null then out_doc - k else out_doc || jsonb_build_object(k, v) end;
  end loop;

  -- counters: max
  foreach k in array array['currentWeek', 'scenariosCompleted', 'pathSeenWeek'] loop
    v := to_jsonb(greatest(app_private.jnum(g -> k), app_private.jnum(r -> k)));
    if v is not null and v <> 'null'::jsonb then
      out_doc := out_doc || jsonb_build_object(k, v);
    end if;
  end loop;

  -- completedActivityIds: union, account's order first
  if jsonb_typeof(r -> 'completedActivityIds') = 'array' or jsonb_typeof(g -> 'completedActivityIds') = 'array' then
    select coalesce(jsonb_agg(x.val order by x.first_pos), '[]'::jsonb) into v
      from (
        select a.val, min(a.pos) as first_pos
          from (
            select e.value as val, e.ordinality as pos
              from jsonb_array_elements(case when jsonb_typeof(r -> 'completedActivityIds') = 'array'
                                             then r -> 'completedActivityIds' else '[]'::jsonb end)
                   with ordinality e
            union all
            select e.value, 1000000 + e.ordinality
              from jsonb_array_elements(case when jsonb_typeof(g -> 'completedActivityIds') = 'array'
                                             then g -> 'completedActivityIds' else '[]'::jsonb end)
                   with ordinality e
          ) a
         group by a.val
      ) x;
    out_doc := out_doc || jsonb_build_object('completedActivityIds', v);
  end if;

  -- skills: per skill, the higher rank; ties keep the guest's (mergeSkills(local, remote))
  if jsonb_typeof(g -> 'skills') = 'object' or jsonb_typeof(r -> 'skills') = 'object' then
    skills := case when jsonb_typeof(g -> 'skills') = 'object' then g -> 'skills' else '{}'::jsonb end;
    -- remote.skills after normalizeSynced: {...local.skills, ...remote.skills}
    rs := skills || case when jsonb_typeof(account -> 'skills') = 'object' then account -> 'skills' else '{}'::jsonb end;
    for k, theirs in select e.key, e.value from jsonb_each(rs) e loop
      if theirs is null or theirs = 'null'::jsonb then
        continue;
      end if;
      if skills -> k is null or skills -> k = 'null'::jsonb
         or app_private.skill_rank(theirs) > app_private.skill_rank(skills -> k) then
        skills := skills || jsonb_build_object(k, theirs);
      end if;
    end loop;
    out_doc := out_doc || jsonb_build_object('skills', skills);
  end if;

  -- streak: the later lastPracticeDay; same day -> more days (ties keep the guest's)
  gs := g -> 'streak';
  rs := r -> 'streak';
  if jsonb_typeof(gs) = 'object' and jsonb_typeof(rs) = 'object' then
    gday := coalesce(gs ->> 'lastPracticeDay', '');
    rday := coalesce(rs ->> 'lastPracticeDay', '');
    if gday = rday then
      v := case when coalesce(app_private.jnum(gs -> 'days'), 0) >= coalesce(app_private.jnum(rs -> 'days'), 0)
                then gs else rs end;
    else
      v := case when gday collate "C" > rday collate "C" then gs else rs end;
    end if;
    out_doc := out_doc || jsonb_build_object('streak', v);
  end if;

  -- weekDays: day-by-day OR over 7 days
  if jsonb_typeof(r -> 'weekDays') = 'array' or jsonb_typeof(g -> 'weekDays') = 'array' then
    select jsonb_agg(app_private.jtruthy(g -> 'weekDays' -> i) or app_private.jtruthy(r -> 'weekDays' -> i) order by i)
      into v
      from generate_series(0, 6) i;
    out_doc := out_doc || jsonb_build_object('weekDays', v);
  end if;

  -- weeklyGoal: target account || guest, done and hitCount max
  gw := g -> 'weeklyGoal';
  rw := r -> 'weeklyGoal';
  if jsonb_typeof(gw) = 'object' or jsonb_typeof(rw) = 'object' then
    gw := case when jsonb_typeof(gw) = 'object' then gw else '{}'::jsonb end;
    rw := case when jsonb_typeof(rw) = 'object' then rw else '{}'::jsonb end;
    v := jsonb_strip_nulls(jsonb_build_object(
      'target', case when app_private.jtruthy(rw -> 'target') then rw -> 'target' else gw -> 'target' end,
      'done', greatest(app_private.jnum(gw -> 'done'), app_private.jnum(rw -> 'done')),
      'hitCount', greatest(app_private.jnum(gw -> 'hitCount'), app_private.jnum(rw -> 'hitCount'))
    ));
    out_doc := out_doc || jsonb_build_object('weeklyGoal', v);
  end if;

  return out_doc;
end;
$$;

revoke execute on function
  app_private.jnum(jsonb),
  app_private.jtruthy(jsonb),
  app_private.skill_rank(jsonb),
  app_private.merge_learner_state(jsonb, jsonb)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- merge_anonymous_user(anonymous_id, permanent_id) -> jsonb summary. Service role only.
-- ---------------------------------------------------------------------------

create function public.merge_anonymous_user(anonymous_id uuid, permanent_id uuid)
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
      update public.learner_state s
         set state = app_private.merge_learner_state(perm_state.state, anon_state.state),
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

revoke execute on function public.merge_anonymous_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_anonymous_user(uuid, uuid) to service_role;
