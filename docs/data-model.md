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
- **Guest mode:** the app works signed out with local demo state. On first sign-in the
  app uploads local `learner_state`, completions, and sessions (deduped by `client_id`).
- **Trainers:** `profiles.can_train` gates cohort creation. Set it via
  `claim_trainer(code)` (security definer) which checks a code in a private table
  `app_private.trainer_codes`, or manually by an admin.

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
| `assignment_items` | `id uuid pk`, `assignment_id`, `kind text check in ('drill','roleplay','learn','any-drill','any-roleplay')`, `ref_id text null`, `skill text null`, `quantity int default 1`, `position int` | `any-*` + `skill` = "2 short practices on Evoking". Same access as parent. |

## Functions (RPC)

- `join_cohort(code text) → cohorts` — normalizes code, inserts membership as learner, idempotent.
- `claim_trainer(code text) → bool`
- `create_cohort(name text, starts_on date) → cohorts` — requires `can_train`; generates `join_code`; adds creator as `cohort_members.role='trainer'`.
- `rotate_join_code(cohort_id uuid) → text` — cohort trainer only.
- `assignment_progress(assignment_id uuid) → table(user_id, display_name, item_id, done int, quantity int)` — counts completions since the assignment's `created_at` matching each item. Trainer of the cohort sees all members; a learner sees only their own rows.
- `cohort_member_stats(cohort_id uuid) → table(user_id, display_name, assigned int, completed int, needs_review int, last_active_at)` — trainer only. Drives the dashboard table (PRD §6).

All security-definer functions: `set search_path = ''`, explicit schema-qualified names,
check `auth.uid()` membership/ownership before returning anything.

## Storage

- Bucket `review-audio` (private). Path `{cohort_id}/{submission_id}/{uuid}.m4a|webm`.
  Cohort trainer uploads/reads; the submitting learner reads.

## API auth (apps/web AI routes)

- Accept **either** `Authorization: Bearer <supabase access token>` (verified server-side;
  per-user rate limit) **or** the guest `x-antelope-key` app token (per-IP limit).
- AI routes stay stateless; the app persists sessions itself through Supabase.

## Environments

- Local: `supabase start` (Docker). Migrations in `supabase/migrations/`, seed in `supabase/seed.sql`
  (demo trainer "Dr. Rosa Lin", cohort "MI for Leaders — Fall pilot" with join code `MIL-DEMO`,
  a demo learner "Amanda", one assignment, one submitted session).
- Hosted: one Supabase project; `supabase link` + `supabase db push`. Env:
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (mobile),
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (web, server only — avoid unless needed).
- Generated types: `supabase gen types typescript --local > packages/core/src/db.types.ts`.
