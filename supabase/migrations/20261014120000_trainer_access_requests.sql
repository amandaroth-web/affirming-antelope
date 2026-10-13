-- Trainer access requests: request access -> an admin approves -> can_train.
--
-- A permanent (non-anonymous) user files a request from /trainer/become. Admins
-- (ADMIN_EMAILS on the web server) review them at /trainer/admin. Every admin read and
-- write goes through the server with the secret key, so the admin_* functions below are
-- granted to service_role only; the API roles can't call them.
--
-- Users can insert their own request and read their own requests. They can't update
-- or delete them, so they can't approve themselves; status, decided_at and decided_by
-- aren't in their column grant at all.
--
-- Rules enforced here, not just in the UI:
--   - one pending request per user (partial unique index)
--   - anonymous users can't request (restrictive policy + trigger with a clear error)
--   - after a decline, a new request only once 7 days have passed (trigger)
--   - a user who can already train can't request (trigger)
--
-- claim_trainer(code) is unchanged: codes still work, for bulk invites.

create table public.trainer_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  organization text not null check (char_length(btrim(organization)) between 1 and 120),
  learner_count text not null check (learner_count in ('1-10', '11-30', '31-100', '100+')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  constraint trainer_access_requests_decided check ((status = 'pending') = (decided_at is null))
);
comment on table public.trainer_access_requests is
  'Requests for trainer access. Users insert/read their own; admins decide via admin_decide_trainer_request() (service role).';

create unique index trainer_access_requests_one_pending
  on public.trainer_access_requests (user_id) where status = 'pending';
create index trainer_access_requests_user_id_created_at_idx
  on public.trainer_access_requests (user_id, created_at desc);
create index trainer_access_requests_pending_idx
  on public.trainer_access_requests (created_at) where status = 'pending';
create index trainer_access_requests_decided_by_idx
  on public.trainer_access_requests (decided_by);

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on table public.trainer_access_requests from public, anon, authenticated;
grant select on table public.trainer_access_requests to authenticated;
grant insert (user_id, name, organization, learner_count, note) on public.trainer_access_requests to authenticated;

alter table public.trainer_access_requests enable row level security;

create policy "trainer_access_requests: read own"
  on public.trainer_access_requests for select to authenticated
  using (user_id = (select auth.uid()));

create policy "trainer_access_requests: insert own"
  on public.trainer_access_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy "trainer_access_requests: permanent users only"
  on public.trainer_access_requests as restrictive for all to authenticated
  using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
  with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

-- ---------------------------------------------------------------------------
-- Insert rules with clear errors (policies can only say "row-level security").
-- ---------------------------------------------------------------------------

create function app_private.trainer_access_requests_before_insert()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  last_declined timestamptz;
begin
  if app_private.is_anonymous_caller() then
    raise exception 'Sign in with your email to request trainer access'
      using errcode = '42501', hint = 'account_required';
  end if;

  if exists (select 1 from public.profiles p where p.id = new.user_id and p.can_train) then
    raise exception 'You already have trainer access' using errcode = 'PT409', hint = 'already_trainer';
  end if;

  select max(r.decided_at) into last_declined
    from public.trainer_access_requests r
   where r.user_id = new.user_id and r.status = 'declined';
  if last_declined is not null and last_declined > now() - interval '7 days' then
    raise exception 'You can send a new request after %', last_declined + interval '7 days'
      using errcode = 'PT429', hint = 'declined_recently';
  end if;

  return new;
end;
$$;

create trigger trainer_access_requests_before_insert
  before insert on public.trainer_access_requests
  for each row execute function app_private.trainer_access_requests_before_insert();

revoke execute on function app_private.trainer_access_requests_before_insert() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin functions. Service role only: the web server calls them after checking
-- ADMIN_EMAILS for the verified user (apps/web/src/lib/trainer/admin.ts).
-- ---------------------------------------------------------------------------

-- Pending requests, oldest first, with the requester's email.
create function public.admin_pending_trainer_requests()
returns table (
  id uuid, user_id uuid, email text, name text, organization text,
  learner_count text, note text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.user_id, u.email::text, r.name, r.organization, r.learner_count, r.note, r.created_at
    from public.trainer_access_requests r
    join auth.users u on u.id = r.user_id
   where r.status = 'pending'
   order by r.created_at
$$;

-- Approve or decline one pending request, atomically. Approving sets can_train.
-- PT404 unknown request, PT409 already decided.
create function public.admin_decide_trainer_request(request_id uuid, approve boolean, admin_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req public.trainer_access_requests;
  requester_email text;
begin
  if admin_id is null then
    raise exception 'admin_id is required' using errcode = '22004';
  end if;

  select r.* into req from public.trainer_access_requests r
   where r.id = admin_decide_trainer_request.request_id
   for update;
  if not found then
    raise exception 'No such request' using errcode = 'PT404';
  end if;
  if req.status <> 'pending' then
    raise exception 'That request was already %', req.status using errcode = 'PT409', hint = 'already_decided';
  end if;

  update public.trainer_access_requests r
     set status = case when approve then 'approved' else 'declined' end,
         decided_at = now(),
         decided_by = admin_id
   where r.id = req.id
  returning r.* into req;

  if approve then
    update public.profiles p set can_train = true where p.id = req.user_id;
  end if;

  select u.email::text into requester_email from auth.users u where u.id = req.user_id;

  return jsonb_build_object(
    'id', req.id,
    'user_id', req.user_id,
    'status', req.status,
    'name', req.name,
    'email', requester_email
  );
end;
$$;

-- Everyone who can train, with cohort count and when they got access (approved
-- request, claimed code, or the account's creation for trainers set by hand).
create function public.admin_trainers()
returns table (
  user_id uuid, display_name text, email text, cohort_count integer,
  trainer_since timestamptz, joined_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id,
         p.display_name,
         u.email::text,
         (select count(*)::integer from public.cohorts c where c.trainer_id = p.id),
         coalesce(
           least(
             (select min(r.decided_at) from public.trainer_access_requests r
               where r.user_id = p.id and r.status = 'approved'),
             (select min(cl.claimed_at) from app_private.trainer_code_claims cl where cl.user_id = p.id)
           ),
           p.created_at
         ),
         p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
   where p.can_train
   order by 5 desc
$$;

create function public.admin_trainer_codes()
returns table (
  code text, note text, max_uses integer, uses integer, expires_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select t.code, t.note, t.max_uses, t.uses, t.expires_at, t.created_at
    from app_private.trainer_codes t
   order by t.created_at desc
$$;

-- Create a trainer code. The server picks a random suffix when the admin doesn't.
-- 22023 bad input, 23505 the code already exists.
create function public.admin_create_trainer_code(
  new_code text, use_limit integer default null, valid_until timestamptz default null, label text default null
)
returns table (
  code text, note text, max_uses integer, uses integer, expires_at timestamptz, created_at timestamptz
)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if new_code is null or new_code !~ '^TRAIN-[A-Z0-9]{3,20}$' then
    raise exception 'Trainer codes look like TRAIN- plus 3 to 20 letters or digits' using errcode = '22023';
  end if;
  if use_limit is not null and use_limit < 1 then
    raise exception 'use_limit must be at least 1' using errcode = '22023';
  end if;
  if label is not null and char_length(label) > 200 then
    raise exception 'Keep the note under 200 characters' using errcode = '22023';
  end if;

  return query
  insert into app_private.trainer_codes as t (code, max_uses, expires_at, note)
  values (new_code, use_limit, valid_until, nullif(btrim(label), ''))
  returning t.code, t.note, t.max_uses, t.uses, t.expires_at, t.created_at;
end;
$$;

revoke execute on function
  public.admin_pending_trainer_requests(),
  public.admin_decide_trainer_request(uuid, boolean, uuid),
  public.admin_trainers(),
  public.admin_trainer_codes(),
  public.admin_create_trainer_code(text, integer, timestamptz, text)
from public, anon, authenticated;

grant execute on function
  public.admin_pending_trainer_requests(),
  public.admin_decide_trainer_request(uuid, boolean, uuid),
  public.admin_trainers(),
  public.admin_trainer_codes(),
  public.admin_create_trainer_code(text, integer, timestamptz, text)
to service_role;
