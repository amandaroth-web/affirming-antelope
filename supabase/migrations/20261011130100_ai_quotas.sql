-- Durable AI quotas. The AI routes (apps/web/src/app/api/*) call
-- public.consume_ai_quota(bucket) with the caller's own JWT before every Anthropic
-- call, so the counter is keyed on auth.uid() and can't be spoofed. It atomically
-- checks and increments, in one transaction:
--   1. the caller's daily limit         -> {allowed:false, reason:'daily'}   (HTTP 429)
--   2. the caller's per-minute burst    -> {allowed:false, reason:'burst'}   (HTTP 429)
--   3. the global daily ceiling         -> {allowed:false, reason:'global'}  (HTTP 503)
-- A denied call increments nothing. Days are UTC.
--
-- Limits live in tables so they can change without a deploy:
--   update app_private.ai_quota_limits set per_day = 100 where tier = 'anonymous' and bucket = 'turn';
--   update app_private.ai_global_limits set per_day = 2000 where bucket = 'debrief';

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------

create table app_private.ai_quota_limits (
  tier text not null check (tier in ('anonymous', 'permanent', 'legacy_ip')),
  bucket text not null check (bucket in ('turn', 'debrief', 'drill')),
  per_day integer not null check (per_day >= 0),
  per_minute integer not null check (per_minute >= 0),
  primary key (tier, bucket)
);
comment on table app_private.ai_quota_limits is
  'Per-caller AI limits. anonymous/permanent: per Supabase user. legacy_ip: per client IP for the old x-antelope-key path (remove after 2026-10-25).';

insert into app_private.ai_quota_limits (tier, bucket, per_day, per_minute) values
  ('anonymous', 'turn', 60, 12),
  ('anonymous', 'debrief', 6, 2),
  ('anonymous', 'drill', 40, 8),
  ('permanent', 'turn', 300, 20),
  ('permanent', 'debrief', 30, 3),
  ('permanent', 'drill', 200, 12),
  ('legacy_ip', 'turn', 30, 10),
  ('legacy_ip', 'debrief', 3, 1),
  ('legacy_ip', 'drill', 15, 5);

-- Circuit breaker across all callers. NULL per_day = no ceiling (still counted).
create table app_private.ai_global_limits (
  bucket text primary key check (bucket in ('turn', 'debrief', 'drill')),
  per_day integer check (per_day >= 0)
);
comment on table app_private.ai_global_limits is
  'Global daily ceiling per bucket. Over it, the AI routes answer 503 "Practice AI is resting" until UTC midnight.';

insert into app_private.ai_global_limits (bucket, per_day) values
  ('turn', 20000),
  ('debrief', 1000),
  ('drill', 10000);

-- ---------------------------------------------------------------------------
-- Counters
-- ---------------------------------------------------------------------------

create table app_private.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  bucket text not null check (bucket in ('turn', 'debrief', 'drill')),
  count integer not null default 0 check (count >= 0),
  -- fixed one-minute window for the burst guard
  minute_start timestamptz,
  minute_count integer not null default 0 check (minute_count >= 0),
  primary key (user_id, day, bucket)
);
create index ai_usage_day_idx on app_private.ai_usage (day);

-- Legacy x-antelope-key callers, keyed on an HMAC of the client IP (never the raw IP).
-- TODO(2026-10-25): drop with the legacy path.
create table app_private.ai_usage_legacy_ip (
  ip_hash text not null check (char_length(ip_hash) between 16 and 128),
  day date not null,
  bucket text not null check (bucket in ('turn', 'debrief', 'drill')),
  count integer not null default 0 check (count >= 0),
  minute_start timestamptz,
  minute_count integer not null default 0 check (minute_count >= 0),
  primary key (ip_hash, day, bucket)
);
create index ai_usage_legacy_ip_day_idx on app_private.ai_usage_legacy_ip (day);

create table app_private.ai_usage_global (
  day date not null,
  bucket text not null check (bucket in ('turn', 'debrief', 'drill')),
  count integer not null default 0 check (count >= 0),
  primary key (day, bucket)
);

alter table app_private.ai_quota_limits enable row level security;
alter table app_private.ai_global_limits enable row level security;
alter table app_private.ai_usage enable row level security;
alter table app_private.ai_usage_legacy_ip enable row level security;
alter table app_private.ai_usage_global enable row level security;
revoke all on table
  app_private.ai_quota_limits, app_private.ai_global_limits, app_private.ai_usage,
  app_private.ai_usage_legacy_ip, app_private.ai_usage_global
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Core: check and take one unit. Exactly one of p_user_id / p_ip_hash is set.
-- ---------------------------------------------------------------------------

create function app_private.take_ai_quota(p_tier text, p_bucket text, p_user_id uuid, p_ip_hash text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  lim app_private.ai_quota_limits;
  global_ceiling integer;
  today date := (now() at time zone 'utc')::date;
  this_minute timestamptz := date_trunc('minute', now());
  to_midnight integer := greatest(1, ceil(extract(epoch from
    ((today + 1)::timestamp at time zone 'utc') - now()))::integer);
  to_next_minute integer := greatest(1, ceil(extract(epoch from (this_minute + interval '1 minute') - now()))::integer);
  used integer;
  m_start timestamptz;
  m_count integer;
  fresh_day boolean;
begin
  select l.* into lim from app_private.ai_quota_limits l where l.tier = p_tier and l.bucket = p_bucket;
  if not found then
    raise exception 'Unknown AI quota bucket "%"', p_bucket using errcode = '22023';
  end if;

  -- Lock this caller's counter row for the rest of the transaction.
  if p_user_id is not null then
    insert into app_private.ai_usage (user_id, day, bucket) values (p_user_id, today, p_bucket)
    on conflict do nothing;
    select u.count, u.minute_start, u.minute_count into used, m_start, m_count
      from app_private.ai_usage u
     where u.user_id = p_user_id and u.day = today and u.bucket = p_bucket
       for update;
  else
    insert into app_private.ai_usage_legacy_ip (ip_hash, day, bucket) values (p_ip_hash, today, p_bucket)
    on conflict do nothing;
    select u.count, u.minute_start, u.minute_count into used, m_start, m_count
      from app_private.ai_usage_legacy_ip u
     where u.ip_hash = p_ip_hash and u.day = today and u.bucket = p_bucket
       for update;
  end if;

  if m_start is distinct from this_minute then
    m_count := 0;
  end if;

  if used >= lim.per_day then
    return jsonb_build_object('allowed', false, 'reason', 'daily', 'limit', lim.per_day,
                              'remaining', 0, 'retry_after', to_midnight);
  end if;
  if m_count >= lim.per_minute then
    return jsonb_build_object('allowed', false, 'reason', 'burst', 'limit', lim.per_day,
                              'remaining', lim.per_day - used, 'retry_after', to_next_minute);
  end if;

  -- Global circuit breaker. The first call of a UTC day also prunes old counters.
  select g.per_day into global_ceiling from app_private.ai_global_limits g where g.bucket = p_bucket;
  insert into app_private.ai_usage_global (day, bucket) values (today, p_bucket)
  on conflict do nothing
  returning true into fresh_day;
  if fresh_day then
    delete from app_private.ai_usage where day < today - 35;
    delete from app_private.ai_usage_legacy_ip where day < today - 35;
    delete from app_private.ai_usage_global where day < today - 400;
  end if;
  update app_private.ai_usage_global g
     set count = g.count + 1
   where g.day = today and g.bucket = p_bucket
     and (global_ceiling is null or g.count < global_ceiling);
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'global', 'limit', lim.per_day,
                              'remaining', lim.per_day - used, 'retry_after', to_midnight);
  end if;

  if p_user_id is not null then
    update app_private.ai_usage u
       set count = u.count + 1, minute_start = this_minute, minute_count = m_count + 1
     where u.user_id = p_user_id and u.day = today and u.bucket = p_bucket;
  else
    update app_private.ai_usage_legacy_ip u
       set count = u.count + 1, minute_start = this_minute, minute_count = m_count + 1
     where u.ip_hash = p_ip_hash and u.day = today and u.bucket = p_bucket;
  end if;

  return jsonb_build_object('allowed', true, 'reason', null, 'limit', lim.per_day,
                            'remaining', lim.per_day - used - 1, 'retry_after', 0);
end;
$$;

revoke execute on function app_private.take_ai_quota(text, text, uuid, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- API
-- ---------------------------------------------------------------------------

-- The caller's own quota. Tier comes from the JWT: is_anonymous false -> permanent,
-- anything else (true, or a token without the claim) -> anonymous, the lower tier.
create function public.consume_ai_quota(bucket text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to use practice AI' using errcode = '42501';
  end if;
  -- A signature-valid JWT can outlive its user (deleted after a merge, or banned).
  if not exists (
    select 1 from auth.users u
     where u.id = uid and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  ) then
    raise exception 'This session has ended. Sign in again.' using errcode = '42501', hint = 'session_invalid';
  end if;
  return app_private.take_ai_quota(
    case when (select (auth.jwt()->>'is_anonymous')::boolean) is false then 'permanent' else 'anonymous' end,
    consume_ai_quota.bucket, uid, null);
end;
$$;

revoke execute on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;

-- Legacy x-antelope-key callers, per IP. Service role only (the API route holds the key).
-- TODO(2026-10-25): drop with the legacy path.
create function public.consume_legacy_ai_quota(ip_hash text, bucket text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if consume_legacy_ai_quota.ip_hash is null or char_length(consume_legacy_ai_quota.ip_hash) not between 16 and 128 then
    raise exception 'ip_hash is required' using errcode = '22023';
  end if;
  return app_private.take_ai_quota('legacy_ip', consume_legacy_ai_quota.bucket, null, consume_legacy_ai_quota.ip_hash);
end;
$$;

revoke execute on function public.consume_legacy_ai_quota(text, text) from public, anon, authenticated;
grant execute on function public.consume_legacy_ai_quota(text, text) to service_role;
