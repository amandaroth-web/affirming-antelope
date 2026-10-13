# Data model (Supabase)

The contract between `supabase/` (schema + RLS), `apps/mobile` (learner), `apps/web`
(trainer dashboard + AI API), and `packages/core` (content). Content (pathway, lessons,
drills, scenarios) stays in code in `packages/core`; the database stores only people,
cohorts, and what people did. Content is referenced by string ids (`PM-017`,
`drill-evoking-05`, unit ids).

Test data only for now (no PHI, no BAA). Keep personal data to name + email anyway.

## Principles

- **Learners own their practice.** A trainer never sees a learner's sessions, drafts,
  or reflections unless the learner submits that one session for review (PRD §7).
  This is enforced by RLS, not app code.
- **No scores.** Trainer `rating` is a qualitative level, never a number shown as a grade.
- **Idempotent sync.** Every learner-created row carries a client-generated `client_id`
  (uuid) unique per user, so the app can retry and upload guest-mode history safely.
- **Server is the source of truth for cohort data; the device is for practice state.**
  `learner_state` mirrors the app's persisted store so progress follows the account.

## Auth

- Supabase Auth, **email one-time code** (6 digits) for learners and trainers.
  Email templates must include `{{ .Token }}`. Local dev mail: Mailpit (`supabase status`).
- `profiles` row is created by a trigger on `auth.users` insert.
- **Guests are anonymous users.** On first launch the app calls `signInAnonymously()`,
  so every app user has a uid and syncs from the start. An anonymous user has the
  `authenticated` role and `is_anonymous: true` in the JWT. They can use their own
  `learner_state`, `activity_completions`, `practice_sessions` and profile. They can't
  join cohorts, submit for review, claim trainer, create cohorts, or see other people
  (restrictive policies + RPC checks, error `42501` hint `account_required`). The check
  fails closed: a JWT without the claim counts as anonymous. Full design and client
  flows: [anonymous-auth.md](anonymous-auth.md).
- **Upgrading** keeps the uid: `updateUser({ email })` then `verifyOtp({ type: 'email_change' })`.
  Requires "Confirm email" on, else Supabase attaches the email without a code.
- **Signing in to an existing account** instead: the app captures the anonymous access
  token, signs in, and calls `POST /api/account/merge-anonymous`, which moves the
  guest's rows into the account (`merge_anonymous_user`) and deletes the guest.
- Installs from before anonymous auth still do the one-time upload of local
  `learner_state`, completions, and sessions (deduped by `client_id`).
- **Trainers:** `profiles.can_train` gates cohort creation. Two ways in:
  - **Request access** (the default): a permanent user files a `trainer_access_requests`
    row from `/trainer/become`; an admin approves it at `/trainer/admin`
    (`admin_decide_trainer_request`, which sets `can_train` in the same transaction).
  - **Trainer code** (bulk invites): `claim_trainer(code)` (security definer) checks a
    code in the private table `app_private.trainer_codes`.
  Admins are the confirmed emails in the web server's `ADMIN_EMAILS`; there's no admin
  flag in the database. Admin reads and writes run with the secret key, server side.

## Tables (schema `public`)

| table | key columns | notes |
|---|---|---|
| `profiles` | `id uuid pk → auth.users`, `display_name text`, `can_train bool default false`, `created_at` | Users read/update their own row (not `can_train`). Trainers can read members of cohorts they train; learners can read their cohort's trainer(s), never fellow learners. |
| `cohorts` | `id uuid pk`, `name text`, `pathway_id text default 'mi-for-leaders'`, `trainer_id uuid → profiles`, `join_code text unique`, `starts_on date`, `archived_at timestamptz`, `created_at` | `join_code` like `MIL-4K7P` (no ambiguous chars), generated server-side. Trainer creates (requires `can_train`) and manages. Members can read their cohorts (not other members' data). |
| `cohort_members` | pk `(cohort_id, user_id)`, `role text check in ('learner','trainer')`, `joined_at` | Insert only via `join_cohort(code)` (security definer). Learner can delete own membership (leave). Cohort trainer reads/removes members. |
| `learner_state` | `user_id uuid pk`, `state jsonb`, `version int`, `updated_at` | Mirror of the mobile zustand store. Owner only. Last-write-wins with `version` check. |
| `activity_completions` | `id uuid pk`, `user_id`, `client_id uuid`, `kind text check in ('learn','drill','roleplay')`, `ref_id text`, `activity_id text null`, `skill text null`, `minutes int`, `completed_at timestamptz` | unique `(user_id, client_id)`. Owner insert/read. Cohort trainers can read **counts/metadata only** through `cohort_member_stats` / `assignment_progress` (security-definer functions or views that expose no transcripts). |
| `practice_sessions` | `id uuid pk`, `user_id`, `client_id uuid`, `kind text check in ('roleplay','drill')`, `ref_id text`, `skill text`, `mode text default 'text'` (`'voice'` later), `transcript jsonb` (`Turn[]`), `debrief jsonb` (`Debrief` / `DrillFeedback`), `self_reflection jsonb`, `started_at`, `ended_at`, `duration_sec int` | unique `(user_id, client_id)`. Owner full access. A cohort trainer can SELECT a session **only if** a `submissions` row exists for it in a cohort they train. |
| `submissions` | `id uuid pk`, `session_id uuid unique → practice_sessions`, `user_id`, `cohort_id → cohorts`, `note_to_trainer text`, `status text check in ('submitted','reviewed','withdrawn')`, `submitted_at`, `reviewed_at` | Learner inserts for own session + a cohort they belong to; can withdraw while `submitted`. Cohort trainer reads; status moves to `reviewed` when a review is saved (trigger). |
| `reviews` | `id uuid pk`, `submission_id → submissions`, `trainer_id`, `feedback text`, `audio_path text null` (Storage), `rating text null check in ('emerging','developing','proficient','strong')`, `recommended_kind text null`, `recommended_ref text null`, `try_again bool default false`, `created_at`, `updated_at`, `learner_seen_at timestamptz null` | Cohort trainer inserts/updates own reviews. Learner reads reviews on own submissions and may set `learner_seen_at` only. |
| `assignments` | `id uuid pk`, `cohort_id`, `title text`, `instructions text`, `due_at timestamptz`, `created_by`, `created_at`, `archived_at` | Cohort trainer CRUD. Members read. |
| `trainer_access_requests` | `id uuid pk`, `user_id → profiles`, `name`, `organization`, `learner_count text check in ('1-10','11-30','31-100','100+')`, `note text null (≤500)`, `status text check in ('pending','approved','declined')`, `created_at`, `decided_at`, `decided_by → profiles` | Permanent users insert and read their own (no update/delete, so no self-approval). One pending per user (partial unique index). After a decline, a new request only 7 days after `decided_at` (trigger, `PT429` hint `declined_recently`); existing trainers get `PT409` hint `already_trainer`; anonymous users `42501` hint `account_required`. |
| `assignment_items` | `id uuid pk`, `assignment_id`, `kind text check in ('drill','roleplay','learn','any-drill','any-roleplay')`, `ref_id text null`, `skill text null`, `quantity int default 1`, `position int` | `any-*` + `skill` = "2 short practices on Evoking". Same access as parent. |

## Functions (RPC)

- `join_cohort(code text) → cohorts` — normalizes code, inserts membership as learner, idempotent.
- `claim_trainer(code text) → bool`
- `create_cohort(name text, starts_on date) → cohorts` — requires `can_train`; generates `join_code`; adds creator as `cohort_members.role='trainer'`.
- `rotate_join_code(cohort_id uuid) → text` — cohort trainer only.
- `assignment_progress(assignment_id uuid) → table(user_id, display_name, item_id, done int, quantity int)` — counts completions since the assignment's `created_at` matching each item. Trainer of the cohort sees all members; a learner sees only their own rows.
- `cohort_member_stats(cohort_id uuid) → table(user_id, display_name, assigned int, completed int, needs_review int, last_active_at)` — trainer only. Drives the dashboard table (PRD §6).
- `consume_ai_quota(bucket text) → jsonb {allowed, reason, limit, remaining, retry_after}` — the caller's own AI quota (`turn`, `debrief`, `drill`), atomically checked and incremented. Tier from the JWT (`anonymous` / `permanent`). `reason`: `daily`, `burst` (per-minute) or `global` (circuit breaker). Denied calls aren't counted. Refuses deleted/banned users.
- `consume_legacy_ai_quota(ip_hash text, bucket text) → jsonb` — service role only; per-IP quota for the legacy `x-antelope-key` path. Remove after 2026-10-25.
- `merge_anonymous_user(anonymous_id uuid, permanent_id uuid, merged_state jsonb, account_version int) → jsonb {learner_state, completions_moved, sessions_moved}` — service role only. When both users have `learner_state`, stores `merged_state` (merged by the API with the app's own rules, `packages/core/src/learnerDoc.ts`) if the account is still at `account_version`, else `PT409` hint `state_changed`; when only the guest has one, moves it. Moves completions/sessions not already in the account (by `client_id`), carries a chosen display name and AI usage. The caller then deletes the anonymous auth user.

- `admin_pending_trainer_requests()`, `admin_decide_trainer_request(request_id uuid, approve bool, admin_id uuid) → jsonb {id, user_id, status, name, email}`, `admin_trainers()`, `admin_trainer_codes()`, `admin_create_trainer_code(new_code text, use_limit int, valid_until timestamptz, label text)` — service role only, for `/trainer/admin`. Deciding is atomic (row lock; `PT409` if already decided) and approving sets `can_train`. Codes must match `^TRAIN-[A-Z0-9]{3,20}$` (`22023`), unique (`23505`).

`join_cohort`, `claim_trainer` and `create_cohort` refuse anonymous callers, and so does inserting a trainer access request.

All security-definer functions: `set search_path = ''`, explicit schema-qualified names,
check `auth.uid()` membership/ownership before returning anything.

## Private tables (schema `app_private`, never exposed)

| table | notes |
|---|---|
| `trainer_codes`, `trainer_code_claims` | trainer access codes |
| `ai_quota_limits` | `(tier, bucket) → per_day, per_minute`. Tiers `anonymous` (turn 60/12, debrief 6/2, drill 40/8), `permanent` (300/20, 30/3, 200/12), `legacy_ip` (30/10, 3/1, 15/5). Edit with SQL, no deploy. |
| `ai_global_limits` | `bucket → per_day` ceiling across everyone (turn 20000, debrief 1000, drill 10000; null = none). Over it the AI routes answer 503 "Practice AI is resting". |
| `ai_usage` | `(user_id, day, bucket) → count`, plus a one-minute window. Cascades with the auth user. Pruned after 35 days. |
| `ai_usage_legacy_ip` | same, keyed on an HMAC of the client IP. Drop after 2026-10-25. |
| `ai_usage_global` | `(day, bucket) → count` for the circuit breaker. |

## Storage

- Bucket `review-audio` (private). Path `{cohort_id}/{submission_id}/{uuid}.m4a|webm`.
  Cohort trainer uploads/reads; the submitting learner reads.

## API auth (apps/web AI routes)

- **Required:** `Authorization: Bearer <supabase access token>`, anonymous or permanent,
  verified with `getClaims`. Then `consume_ai_quota(bucket)` runs **with the caller's JWT**
  (so the uid can't be spoofed) right before the AI call: 429 `quota_exceeded` (daily or
  burst, with `retry_after`), 503 `ai_resting` (global ceiling). Fails closed (503) if the
  quota can't be checked.
- **Legacy:** the shared `x-antelope-key` is accepted until 2026-10-25 behind
  `ALLOW_LEGACY_APP_TOKEN` (default on until then), with a durable per-IP quota.
- `POST /api/account/merge-anonymous` (bearer = permanent user, body
  `{ anonymousAccessToken }`) uses the server-only secret key.
- AI routes stay stateless; the app persists sessions itself through Supabase.
- Error codes: [anonymous-auth.md](anonymous-auth.md#error-codes-the-client-must-handle).

## Environments

- Local: `supabase start` (Docker). Migrations in `supabase/migrations/`, seed in `supabase/seed.sql`
  (demo trainer "Dr. Rosa Lin", cohort "MI for Leaders — Fall pilot" with join code `MIL-DEMO`,
  a demo learner "Amanda", one assignment, one submitted session).
- Hosted: one Supabase project; `supabase link` + `supabase db push`. Env:
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (mobile),
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
  (or legacy `SUPABASE_SERVICE_ROLE_KEY`; web, server only — used by merge-anonymous,
  the legacy quota and `/trainer/admin`), `ALLOW_LEGACY_APP_TOKEN` (until 2026-10-25),
  `ADMIN_EMAILS` (web, server only), `RESEND_API_KEY` (web, server only; `EMAIL_MODE=log`
  prints emails instead of sending).
- Generated types: `supabase gen types typescript --local > packages/core/src/db.types.ts`.
