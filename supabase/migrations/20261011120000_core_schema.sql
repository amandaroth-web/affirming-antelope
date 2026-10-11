-- Affirming Antelope core schema: people, cohorts, and what people did.
-- Contract: docs/data-model.md. Content (pathway, lessons, drills, scenarios) lives in
-- packages/core and is referenced here by string ids.
--
-- Access model in one paragraph: learners own their practice. Every learner table is
-- owner-only. A trainer reaches learner data in exactly two ways: (1) a session the
-- learner submitted to a cohort the trainer trains, and (2) counts/metadata through the
-- security-definer RPCs in the next migration. Membership writes go through RPCs only.

-- ---------------------------------------------------------------------------
-- Schemas
-- ---------------------------------------------------------------------------

-- Private schema: not listed in config.toml [api].schemas, so PostgREST never exposes it.
-- `authenticated` gets USAGE only so RLS policies can call the helper functions below;
-- the tables in it grant nothing to API roles.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

-- Shared value type for packages/core SkillId.
create domain public.skill_id as text
  check (value in (
    'oars', 'engaging', 'focusing', 'evoking', 'planning',
    'change-talk', 'sustain-talk', 'discord', 'leadership', 'full-conversation'
  ));

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  can_train boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per auth user, created by trigger. can_train is set by claim_trainer() or an admin.';

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  pathway_id text not null default 'mi-for-leaders',
  trainer_id uuid not null references public.profiles (id) on delete restrict,
  join_code text not null unique check (join_code ~ '^MIL-[A-Z0-9]{4}$'),
  starts_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index cohorts_trainer_id_idx on public.cohorts (trainer_id);
comment on table public.cohorts is 'Created via create_cohort(). Archive with archived_at instead of deleting.';

create table public.cohort_members (
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'learner' check (role in ('learner', 'trainer')),
  joined_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);
create index cohort_members_user_id_role_idx on public.cohort_members (user_id, role);
create index cohort_members_cohort_id_role_idx on public.cohort_members (cohort_id, role);
comment on table public.cohort_members is 'Insert only via join_cohort()/create_cohort(). Learners may delete their own row to leave.';

create table public.learner_state (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now()
);
comment on table public.learner_state is 'Mirror of the mobile zustand store. Updates must send a higher version than stored, else SQLSTATE PT409.';

create table public.activity_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client_id uuid not null,
  kind text not null check (kind in ('learn', 'drill', 'roleplay')),
  ref_id text not null check (char_length(ref_id) between 1 and 100),
  activity_id text check (char_length(activity_id) <= 100),
  skill public.skill_id,
  minutes integer not null default 0 check (minutes between 0 and 600),
  completed_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index activity_completions_user_completed_idx on public.activity_completions (user_id, completed_at desc);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client_id uuid not null,
  kind text not null check (kind in ('roleplay', 'drill')),
  ref_id text not null check (char_length(ref_id) between 1 and 100),
  skill public.skill_id,
  mode text not null default 'text' check (mode in ('text', 'voice')),
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  debrief jsonb check (debrief is null or jsonb_typeof(debrief) = 'object'),
  self_reflection jsonb check (self_reflection is null or jsonb_typeof(self_reflection) = 'object'),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec integer check (duration_sec >= 0),
  unique (user_id, client_id),
  -- Target for the submissions composite FK, so a submission always belongs to the session owner.
  unique (id, user_id),
  check (ended_at is null or ended_at >= started_at)
);
create index practice_sessions_user_started_idx on public.practice_sessions (user_id, started_at desc);
comment on column public.practice_sessions.transcript is 'Turn[] from @antelope/core';
comment on column public.practice_sessions.debrief is 'Debrief (roleplay) or DrillFeedback (drill) from @antelope/core';
comment on column public.practice_sessions.self_reflection is 'SelfReflection from @antelope/core';

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  note_to_trainer text check (char_length(note_to_trainer) <= 2000),
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  foreign key (session_id, user_id) references public.practice_sessions (id, user_id) on delete cascade
);
create index submissions_user_id_idx on public.submissions (user_id);
create index submissions_session_user_idx on public.submissions (session_id, user_id);
create index submissions_cohort_status_idx on public.submissions (cohort_id, status);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  trainer_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  feedback text not null default '' check (char_length(feedback) <= 10000),
  audio_path text check (
    audio_path is null or (
      audio_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(m4a|webm)$'
      and split_part(audio_path, '/', 2) = submission_id::text
    )
  ),
  rating text check (rating in ('emerging', 'developing', 'proficient', 'strong')),
  recommended_kind text check (recommended_kind in ('learn', 'drill', 'roleplay')),
  recommended_ref text check (char_length(recommended_ref) <= 100),
  try_again boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  learner_seen_at timestamptz,
  check (recommended_ref is null or recommended_kind is not null)
);
create index reviews_trainer_id_idx on public.reviews (trainer_id);
comment on column public.reviews.rating is 'Qualitative level, never shown as a score.';
comment on column public.reviews.audio_path is 'review-audio bucket path: {cohort_id}/{submission_id}/{uuid}.m4a|webm';

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  due_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index assignments_cohort_due_idx on public.assignments (cohort_id, due_at);
create index assignments_created_by_idx on public.assignments (created_by);

create table public.assignment_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  kind text not null check (kind in ('drill', 'roleplay', 'learn', 'any-drill', 'any-roleplay')),
  ref_id text check (char_length(ref_id) <= 100),
  skill public.skill_id,
  quantity integer not null default 1 check (quantity between 1 and 50),
  position integer not null default 0,
  -- Specific items name a content id; any-* items name (optionally) a skill instead.
  check ((kind like 'any-%') = (ref_id is null))
);
create index assignment_items_assignment_position_idx on public.assignment_items (assignment_id, position);

-- ---------------------------------------------------------------------------
-- Private tables
-- ---------------------------------------------------------------------------

create table app_private.trainer_codes (
  code text primary key check (code = upper(btrim(code))),
  note text,
  max_uses integer check (max_uses > 0),
  uses integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table app_private.trainer_code_claims (
  code text not null references app_private.trainer_codes (code) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (code, user_id)
);
create index trainer_code_claims_user_id_idx on app_private.trainer_code_claims (user_id);

alter table app_private.trainer_codes enable row level security;
alter table app_private.trainer_code_claims enable row level security;
revoke all on table app_private.trainer_codes, app_private.trainer_code_claims from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS helper functions. Security definer so policies don't recurse through
-- cohort_members' own RLS. Each returns a set so policies can use
-- `col in (select app_private.fn())`, which Postgres evaluates once per statement.
-- ---------------------------------------------------------------------------

create function app_private.trained_cohort_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.cohort_id from public.cohort_members m
   where m.user_id = (select auth.uid()) and m.role = 'trainer'
  union
  select c.id from public.cohorts c
   where c.trainer_id = (select auth.uid())
$$;

create function app_private.visible_cohort_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.cohort_id from public.cohort_members m
   where m.user_id = (select auth.uid())
  union
  select c.id from public.cohorts c
   where c.trainer_id = (select auth.uid())
$$;

create function app_private.member_cohort_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.cohort_id from public.cohort_members m
   where m.user_id = (select auth.uid())
$$;

create function app_private.trained_member_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.user_id from public.cohort_members m
   where m.cohort_id in (select app_private.trained_cohort_ids())
$$;

-- Submissions a trainer may see: in a cohort they train, not withdrawn.
create function app_private.trainer_submission_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select s.id from public.submissions s
   where s.status <> 'withdrawn'
     and s.cohort_id in (select app_private.trained_cohort_ids())
$$;

create function app_private.own_submission_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select s.id from public.submissions s
   where s.user_id = (select auth.uid())
$$;

create function app_private.trainer_session_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select s.session_id from public.submissions s
   where s.status <> 'withdrawn'
     and s.cohort_id in (select app_private.trained_cohort_ids())
$$;

create function app_private.visible_assignment_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select a.id from public.assignments a
   where a.cohort_id in (select app_private.visible_cohort_ids())
$$;

create function app_private.trained_assignment_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select a.id from public.assignments a
   where a.cohort_id in (select app_private.trained_cohort_ids())
$$;

revoke execute on function
  app_private.trained_cohort_ids(),
  app_private.visible_cohort_ids(),
  app_private.member_cohort_ids(),
  app_private.trained_member_ids(),
  app_private.trainer_submission_ids(),
  app_private.own_submission_ids(),
  app_private.trainer_session_ids(),
  app_private.visible_assignment_ids(),
  app_private.trained_assignment_ids()
from public, anon;
grant execute on function
  app_private.trained_cohort_ids(),
  app_private.visible_cohort_ids(),
  app_private.member_cohort_ids(),
  app_private.trained_member_ids(),
  app_private.trainer_submission_ids(),
  app_private.own_submission_ids(),
  app_private.trainer_session_ids(),
  app_private.visible_assignment_ids(),
  app_private.trained_assignment_ids()
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- New auth user -> profile. display_name: signup metadata, else the email's local part.
create function app_private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Learner'
    ), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- learner_state: optimistic concurrency + updated_at.
create function app_private.learner_state_before_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.version <= old.version then
    raise exception 'learner_state version conflict: server has %, got %', old.version, new.version
      using errcode = 'PT409', hint = 'Refetch learner_state, merge, and write with version = server version + 1.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger learner_state_before_update
  before update on public.learner_state
  for each row execute function app_private.learner_state_before_update();

-- reviews: the learner (submission owner) may change learner_seen_at only, and that
-- does not bump updated_at. Trainers may not touch learner_seen_at.
create function app_private.reviews_before_update()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is not null and uid is distinct from old.trainer_id then
    if (to_jsonb(new) - 'learner_seen_at' - 'updated_at')
       is distinct from (to_jsonb(old) - 'learner_seen_at' - 'updated_at') then
      raise exception 'Learners can only mark a review as seen'
        using errcode = '42501';
    end if;
    new.updated_at := old.updated_at;
  else
    if uid is not null and new.learner_seen_at is distinct from old.learner_seen_at then
      raise exception 'Only the learner can mark a review as seen'
        using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger reviews_before_update
  before update on public.reviews
  for each row execute function app_private.reviews_before_update();

-- Saving a review moves its submission to `reviewed`.
create function app_private.reviews_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.submissions s
     set status = 'reviewed',
         reviewed_at = coalesce(s.reviewed_at, now())
   where s.id = new.submission_id
     and s.status <> 'reviewed';
  return new;
end;
$$;

create trigger reviews_after_insert
  after insert on public.reviews
  for each row execute function app_private.reviews_after_insert();

revoke execute on function
  app_private.handle_new_user(),
  app_private.learner_state_before_update(),
  app_private.reviews_before_update(),
  app_private.reviews_after_insert()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges. RLS decides which rows; grants decide which columns and verbs.
-- anon gets nothing on any table: the app is local-only when signed out.
-- ---------------------------------------------------------------------------

revoke all on table
  public.profiles, public.cohorts, public.cohort_members, public.learner_state,
  public.activity_completions, public.practice_sessions, public.submissions,
  public.reviews, public.assignments, public.assignment_items
from anon, authenticated;

grant select on table
  public.profiles, public.cohorts, public.cohort_members, public.learner_state,
  public.activity_completions, public.practice_sessions, public.submissions,
  public.reviews, public.assignments, public.assignment_items
to authenticated;

-- profiles: rename yourself; can_train only via claim_trainer() or an admin.
grant update (display_name) on public.profiles to authenticated;

-- cohorts: created by create_cohort(); join_code changes via rotate_join_code().
grant update (name, pathway_id, starts_on, archived_at) on public.cohorts to authenticated;

-- cohort_members: inserted by RPCs; role is never client-writable.
grant delete on public.cohort_members to authenticated;

grant insert, update, delete on public.learner_state to authenticated;

-- completions are append-only from the client (upsert with ignoreDuplicates).
grant insert on public.activity_completions to authenticated;

grant insert, update, delete on public.practice_sessions to authenticated;

grant insert (id, session_id, user_id, cohort_id, note_to_trainer) on public.submissions to authenticated;
grant update (status, note_to_trainer) on public.submissions to authenticated;

grant insert (id, submission_id, trainer_id, feedback, audio_path, rating, recommended_kind, recommended_ref, try_again)
  on public.reviews to authenticated;
grant update (feedback, audio_path, rating, recommended_kind, recommended_ref, try_again, learner_seen_at)
  on public.reviews to authenticated;

grant insert, delete on public.assignments to authenticated;
grant update (title, instructions, due_at, archived_at) on public.assignments to authenticated;

grant insert, delete on public.assignment_items to authenticated;
grant update (kind, ref_id, skill, quantity, position) on public.assignment_items to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;
alter table public.learner_state enable row level security;
alter table public.activity_completions enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.submissions enable row level security;
alter table public.reviews enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_items enable row level security;

-- profiles
create policy "profiles: read own, or members of cohorts I train"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select app_private.trained_member_ids()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- cohorts
create policy "cohorts: members and trainer read"
  on public.cohorts for select to authenticated
  using (id in (select app_private.visible_cohort_ids()));

create policy "cohorts: trainer updates"
  on public.cohorts for update to authenticated
  using (id in (select app_private.trained_cohort_ids()))
  with check (id in (select app_private.trained_cohort_ids()));

-- cohort_members
create policy "cohort_members: read own rows, or all rows of cohorts I train"
  on public.cohort_members for select to authenticated
  using (user_id = (select auth.uid()) or cohort_id in (select app_private.trained_cohort_ids()));

create policy "cohort_members: learner leaves, or trainer removes a learner"
  on public.cohort_members for delete to authenticated
  using (
    role = 'learner'
    and (user_id = (select auth.uid()) or cohort_id in (select app_private.trained_cohort_ids()))
  );

-- learner_state: owner only
create policy "learner_state: owner reads"
  on public.learner_state for select to authenticated
  using (user_id = (select auth.uid()));
create policy "learner_state: owner inserts"
  on public.learner_state for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "learner_state: owner updates"
  on public.learner_state for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "learner_state: owner deletes"
  on public.learner_state for delete to authenticated
  using (user_id = (select auth.uid()));

-- activity_completions: owner insert/read; trainers only via RPC aggregates
create policy "activity_completions: owner reads"
  on public.activity_completions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "activity_completions: owner inserts"
  on public.activity_completions for insert to authenticated
  with check (user_id = (select auth.uid()));

-- practice_sessions: owner full access; trainer reads submitted sessions only
create policy "practice_sessions: owner, or trainer of the cohort it was submitted to"
  on public.practice_sessions for select to authenticated
  using (user_id = (select auth.uid()) or id in (select app_private.trainer_session_ids()));
create policy "practice_sessions: owner inserts"
  on public.practice_sessions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "practice_sessions: owner updates"
  on public.practice_sessions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "practice_sessions: owner deletes"
  on public.practice_sessions for delete to authenticated
  using (user_id = (select auth.uid()));

-- submissions
create policy "submissions: owner, or trainer of the cohort"
  on public.submissions for select to authenticated
  using (user_id = (select auth.uid()) or id in (select app_private.trainer_submission_ids()));

create policy "submissions: learner submits own session to a cohort they belong to"
  on public.submissions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'submitted'
    and reviewed_at is null
    and cohort_id in (select app_private.member_cohort_ids())
    and session_id in (
      select ps.id from public.practice_sessions ps where ps.user_id = (select auth.uid())
    )
  );

create policy "submissions: learner withdraws while submitted"
  on public.submissions for update to authenticated
  using (user_id = (select auth.uid()) and status = 'submitted')
  with check (user_id = (select auth.uid()) and status in ('submitted', 'withdrawn'));

-- reviews
create policy "reviews: trainer of the cohort, or the submitting learner"
  on public.reviews for select to authenticated
  using (
    submission_id in (select app_private.trainer_submission_ids())
    or submission_id in (select app_private.own_submission_ids())
  );

create policy "reviews: cohort trainer creates own review"
  on public.reviews for insert to authenticated
  with check (
    trainer_id = (select auth.uid())
    and learner_seen_at is null
    and submission_id in (select app_private.trainer_submission_ids())
  );

-- Column-level rules for each side live in app_private.reviews_before_update().
create policy "reviews: trainer edits own review, learner marks seen"
  on public.reviews for update to authenticated
  using (
    (trainer_id = (select auth.uid()) and submission_id in (select app_private.trainer_submission_ids()))
    or submission_id in (select app_private.own_submission_ids())
  )
  with check (
    (trainer_id = (select auth.uid()) and submission_id in (select app_private.trainer_submission_ids()))
    or submission_id in (select app_private.own_submission_ids())
  );

-- assignments
create policy "assignments: members and trainer read"
  on public.assignments for select to authenticated
  using (cohort_id in (select app_private.visible_cohort_ids()));
create policy "assignments: trainer creates"
  on public.assignments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and cohort_id in (select app_private.trained_cohort_ids())
  );
create policy "assignments: trainer updates"
  on public.assignments for update to authenticated
  using (cohort_id in (select app_private.trained_cohort_ids()))
  with check (cohort_id in (select app_private.trained_cohort_ids()));
create policy "assignments: trainer deletes"
  on public.assignments for delete to authenticated
  using (cohort_id in (select app_private.trained_cohort_ids()));

-- assignment_items: same access as the parent assignment
create policy "assignment_items: members and trainer read"
  on public.assignment_items for select to authenticated
  using (assignment_id in (select app_private.visible_assignment_ids()));
create policy "assignment_items: trainer creates"
  on public.assignment_items for insert to authenticated
  with check (assignment_id in (select app_private.trained_assignment_ids()));
create policy "assignment_items: trainer updates"
  on public.assignment_items for update to authenticated
  using (assignment_id in (select app_private.trained_assignment_ids()))
  with check (assignment_id in (select app_private.trained_assignment_ids()));
create policy "assignment_items: trainer deletes"
  on public.assignment_items for delete to authenticated
  using (assignment_id in (select app_private.trained_assignment_ids()));
