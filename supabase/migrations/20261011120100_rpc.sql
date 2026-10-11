-- RPCs (docs/data-model.md "Functions"). All are security definer with an empty
-- search_path and check auth.uid() before touching anything. Errors use SQLSTATEs that
-- PostgREST maps to HTTP statuses: 42501 -> 401/403, PTxyz -> HTTP xyz.

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- `MIL-` + 4 chars from an alphabet without 0/O, 1/I/L. Retries until unused.
create function app_private.generate_join_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  bytes bytea;
begin
  loop
    bytes := extensions.gen_random_bytes(4);
    candidate := 'MIL-'
      || substr(alphabet, (get_byte(bytes, 0) % length(alphabet)) + 1, 1)
      || substr(alphabet, (get_byte(bytes, 1) % length(alphabet)) + 1, 1)
      || substr(alphabet, (get_byte(bytes, 2) % length(alphabet)) + 1, 1)
      || substr(alphabet, (get_byte(bytes, 3) % length(alphabet)) + 1, 1);
    exit when not exists (select 1 from public.cohorts c where c.join_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- How many of a user's completions since `since` satisfy one assignment item.
--   drill / roleplay / learn : same kind and the item's ref_id matches ref_id or activity_id
--   any-drill / any-roleplay : that kind, and the item's skill if it has one
create function app_private.item_completion_count(
  p_user_id uuid, p_kind text, p_ref_id text, p_skill text, p_since timestamptz
)
returns integer
language sql stable set search_path = ''
as $$
  select count(*)::integer
    from public.activity_completions c
   where c.user_id = p_user_id
     and c.completed_at >= p_since
     and case p_kind
           when 'any-drill' then c.kind = 'drill' and (p_skill is null or c.skill = p_skill)
           when 'any-roleplay' then c.kind = 'roleplay' and (p_skill is null or c.skill = p_skill)
           else c.kind = p_kind and p_ref_id in (c.ref_id, c.activity_id)
         end
$$;

revoke execute on function
  app_private.generate_join_code(),
  app_private.item_completion_count(uuid, text, text, text, timestamptz)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- join_cohort(code) -> cohorts
-- Accepts "MIL-4K7P", "mil 4k7p", "MIL4K7P" or just "4K7P". Idempotent: joining a
-- cohort you're already in returns it unchanged (a trainer stays a trainer).
-- ---------------------------------------------------------------------------
create function public.join_cohort(code text)
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

-- ---------------------------------------------------------------------------
-- claim_trainer(code) -> bool
-- True if the code is valid (or this user already claimed it); sets can_train.
-- False for unknown, expired or used-up codes. Never says which.
-- ---------------------------------------------------------------------------
create function public.claim_trainer(code text)
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

-- ---------------------------------------------------------------------------
-- create_cohort(name, starts_on) -> cohorts. Requires profiles.can_train.
-- ---------------------------------------------------------------------------
create function public.create_cohort(name text, starts_on date default null)
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
  if not exists (select 1 from public.profiles p where p.id = uid and p.can_train) then
    raise exception 'Only trainers can create cohorts' using errcode = '42501';
  end if;

  insert into public.cohorts (name, trainer_id, join_code, starts_on)
  values (btrim(create_cohort.name), uid, app_private.generate_join_code(), create_cohort.starts_on)
  returning * into created;

  insert into public.cohort_members (cohort_id, user_id, role)
  values (created.id, uid, 'trainer')
  on conflict (cohort_id, user_id) do update set role = 'trainer';

  return created;
end;
$$;

-- ---------------------------------------------------------------------------
-- rotate_join_code(cohort_id) -> text. Cohort trainer only.
-- ---------------------------------------------------------------------------
create function public.rotate_join_code(cohort_id uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  new_code text;
begin
  if auth.uid() is null
     or rotate_join_code.cohort_id is null
     or rotate_join_code.cohort_id not in (select app_private.trained_cohort_ids()) then
    raise exception 'Only this cohort''s trainer can rotate its code' using errcode = '42501';
  end if;

  new_code := app_private.generate_join_code();
  update public.cohorts c set join_code = new_code where c.id = rotate_join_code.cohort_id;
  return new_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- assignment_progress(assignment_id) -> one row per (learner, item).
-- Cohort trainer: every learner in the cohort. Learner member: own rows only.
-- Anyone else: no rows. `done` counts completions since the assignment's created_at,
-- capped at the item's quantity.
-- ---------------------------------------------------------------------------
create function public.assignment_progress(assignment_id uuid)
returns table (user_id uuid, display_name text, item_id uuid, done integer, quantity integer)
language sql stable security definer set search_path = ''
as $$
  with a as (
    select a.id, a.cohort_id, a.created_at,
           a.cohort_id in (select app_private.trained_cohort_ids()) as viewer_trains
      from public.assignments a
     where a.id = assignment_progress.assignment_id
  ),
  learners as (
    select m.user_id
      from public.cohort_members m
      join a on a.cohort_id = m.cohort_id
     where m.role = 'learner'
       and (a.viewer_trains or m.user_id = (select auth.uid()))
  )
  select l.user_id,
         p.display_name,
         i.id,
         least(i.quantity,
               app_private.item_completion_count(l.user_id, i.kind, i.ref_id, i.skill, a.created_at)),
         i.quantity
    from learners l
    join public.profiles p on p.id = l.user_id
    cross join a
    join public.assignment_items i on i.assignment_id = a.id
   order by p.display_name, l.user_id, i.position, i.id
$$;

-- ---------------------------------------------------------------------------
-- cohort_member_stats(cohort_id) -> one row per learner. Trainer only (else no rows).
--   assigned       sum of item quantities across the cohort's non-archived assignments
--   completed      of those, how many the learner has done (capped per item)
--   needs_review   the learner's submissions in this cohort still `submitted`
--   last_active_at latest activity completion (any activity, any time)
-- ---------------------------------------------------------------------------
create function public.cohort_member_stats(cohort_id uuid)
returns table (
  user_id uuid, display_name text, assigned integer, completed integer,
  needs_review integer, last_active_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  with learners as (
    select m.user_id
      from public.cohort_members m
     where m.cohort_id = cohort_member_stats.cohort_id
       and m.role = 'learner'
       and cohort_member_stats.cohort_id in (select app_private.trained_cohort_ids())
  ),
  items as (
    select i.kind, i.ref_id, i.skill, i.quantity, a.created_at as since
      from public.assignment_items i
      join public.assignments a on a.id = i.assignment_id
     where a.cohort_id = cohort_member_stats.cohort_id
       and a.archived_at is null
  ),
  progress as (
    select l.user_id,
           sum(least(i.quantity,
                     app_private.item_completion_count(l.user_id, i.kind, i.ref_id, i.skill, i.since)))::integer
             as completed
      from learners l
      cross join items i
     group by l.user_id
  )
  select l.user_id,
         p.display_name,
         coalesce((select sum(i.quantity) from items i), 0)::integer,
         coalesce(pr.completed, 0),
         (select count(*)::integer from public.submissions s
           where s.user_id = l.user_id
             and s.cohort_id = cohort_member_stats.cohort_id
             and s.status = 'submitted'),
         (select max(c.completed_at) from public.activity_completions c where c.user_id = l.user_id)
    from learners l
    join public.profiles p on p.id = l.user_id
    left join progress pr on pr.user_id = l.user_id
   order by p.display_name, l.user_id
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: signed-in users only.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.join_cohort(text),
  public.claim_trainer(text),
  public.create_cohort(text, date),
  public.rotate_join_code(uuid),
  public.assignment_progress(uuid),
  public.cohort_member_stats(uuid)
from public, anon;

grant execute on function
  public.join_cohort(text),
  public.claim_trainer(text),
  public.create_cohort(text, date),
  public.rotate_join_code(uuid),
  public.assignment_progress(uuid),
  public.cohort_member_stats(uuid)
to authenticated, service_role;
