# Anonymous auth and AI quotas

Design note and record. Phase 1 (database and API) and phase 2 (the mobile client:
`apps/mobile/src/sync/{anonymous,auth,engine}.ts`, `src/lib/api.ts`) are on branch
`anon-auth`. Phase 1 added migrations `20261012130000_anonymous_users.sql`,
`20261012130100_ai_quotas.sql` and `20261012130200_merge_anonymous_user.sql`, plus the
API changes in `apps/web/src/lib/ai/auth.ts` and `apps/web/src/app/api/account/merge-anonymous`.

## Why

The AI routes used to accept guests with a shared `x-antelope-key`. That key ships in the
public bundle, so anyone could spend the Anthropic budget, and the rate limits were
in-memory per serverless instance. Now every app user is a Supabase user from first
launch. Guests are **anonymous users** (`signInAnonymously`). AI spend is capped by
durable per-user quotas in Postgres, and a global ceiling sits on top of those.

This also removes the guest-to-account upload path. A guest's practice already sits in
`learner_state`, `activity_completions` and `practice_sessions` under their uid. When the
guest converts, the uid stays the same, so the data stays put.

## What an anonymous user can do

| | anonymous | permanent |
|---|---|---|
| own `learner_state`, `activity_completions`, `practice_sessions` | yes | yes |
| own profile (read, rename) | yes | yes |
| AI routes | yes (lower quotas) | yes |
| `join_cohort`, `claim_trainer`, `create_cohort` | **no**: `42501`, hint `account_required` | yes |
| send a session for review (`submissions` insert) | **no**: `42501`, hint `account_required` | yes |
| cohorts, assignments, reviews, trainer profiles, review audio | **no** (empty results) | per existing RLS |

The check is the `is_anonymous` JWT claim, `(select (auth.jwt()->>'is_anonymous')::boolean)`,
used in restrictive policies and in the RPCs. It **fails closed**: a token without the
claim counts as anonymous.

## Client flows

All examples use `supabase-js` v2.

### First launch

```ts
const { data: { session } } = await supabase.auth.getSession();
if (!session) await supabase.auth.signInAnonymously();
```

- Store the session the same way as a signed-in session. supabase-js refreshes it
  automatically.
- Every AI request sends `Authorization: Bearer <access_token>`. Stop sending `x-antelope-key`.
- Sync runs exactly as it does for a signed-in user: same tables, same `client_id`
  dedupe, same PT409 merge. The guest-mode upload path (`adoptOnSignIn` with
  `hasGuestWork`) is only needed for installs that predate this change. See the
  migration note below.
- If `signInAnonymously` fails (offline, or HTTP 429 `over_request_rate_limit`), stay
  local-only and retry on the next launch or when the app comes to the foreground.
  Practice works offline. AI routes return 401 until a session exists.

### Upgrade a guest (keep the same uid)

```ts
const { error } = await supabase.auth.updateUser({ email });   // sends a 6-digit code
// error?.code === 'email_exists' -> this email already has an account: go to "Existing account"
const { data, error: e2 } = await supabase.auth.verifyOtp({ email, token: code, type: 'email_change' });
// data.user.is_anonymous === false; data.session carries is_anonymous: false
```

- `updateUser({ email })` on its own does **not** convert. Supabase sends the
  `email_change` template, which contains `{{ .Token }}`, and the user stays anonymous
  until `verifyOtp` with `type: 'email_change'` succeeds. This depends on **Confirm
  email** being on (see Hosted settings). With it off, Supabase attaches the email
  immediately with no code.
- After verifying, use the new session. Its JWT has `is_anonymous: false`, so cohorts,
  submissions and permanent quotas open up straight away. Call `refreshSession()` if
  anything still holds the old token.
- Then ask for a display name. `profiles.display_name` is `Learner` for anonymous users,
  and `display_name_set` stays false until they choose one.
- Expect `over_email_send_rate_limit` (429) and an expired or invalid code
  (`otp_expired`, 403). Let the user resend.

### Existing account (sign in, then merge)

Use this when `updateUser({ email })` returns `email_exists`, or when the user picks
"I already have an account".

```ts
const anon = (await supabase.auth.getSession()).data.session;   // 1. capture BEFORE switching
// if anon expires within ~10 minutes: await supabase.auth.refreshSession() and re-read it
await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
const { data } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });   // 2. now the permanent user
const res = await fetch(`${API}/api/account/merge-anonymous`, {                          // 3. merge
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
  body: JSON.stringify({ anonymousAccessToken: anon.access_token }),
});
// 4. pull learner_state (and completions/sessions) for the permanent uid
```

- **Don't call `signOut()` on the anonymous session before merging.** That revokes it,
  and the merge then fails with `invalid_anonymous_token`. Signing in with OTP replaces
  the local session without revoking the old one.
- The anonymous access token must still be valid: signed correctly, not expired, its
  user still exists, and still anonymous. Access tokens last 1 hour, so refresh first
  if the token is close to expiring.
- Make the merge idempotent on the client. Persist `anon.access_token` until you get a
  200 or a terminal error (`invalid_anonymous_token`, `not_anonymous`, `not_found`).
  Retry the call on network errors or 5xx.
- Flush the sync outbox while still anonymous (before step 1's switch), so every guest
  row is on the server and moves with the merge. Anything still queued afterwards must
  be re-stamped with the permanent uid before upload (`client_id` dedupes it).
- After the merge, the server's `learner_state` is the merged document with `version`
  bumped. Fetch it and adopt it (`normalizeSynced`), and refresh completions and sessions.

Response `200`:

```json
{ "merged": true, "learnerState": "merged" | "moved" | "none",
  "completionsMoved": 3, "sessionsMoved": 1, "anonymousUserDeleted": true }
```

What the server does (`public.merge_anonymous_user`, which only the service role can call):

- **`learner_state`**: the route reads both documents and merges them with the app's own
  code (`mergeGuestIntoAccount` in `packages/core/src/learnerDoc.ts`: the account is
  "remote", the guest "local", exactly as a guest device signing in). The SQL stores the
  result only if the account's version is still the one read (else `PT409 state_changed`,
  and the route re-reads and retries). A guest with no completions leaves the account's
  document as it was.
- **Completions and sessions** move to the account, except `client_id`s the account
  already has.
- **The guest's chosen display name** fills the account's name if the account never
  chose one.
- **Today's AI usage** is added to the account's, so merging can't be used to reset a
  quota.
- **The anonymous auth user** is then deleted. If that delete fails, the route returns
  `anonymousUserDeleted: false`. The data has already moved, and the stale-user cleanup
  removes the empty user later.

### Sign out

Sign out starts a **clean guest**. Clinicians share devices, so the next person must not
see or inherit the signed-out account's practice, history, cohort, inbox or name. The
account's practice lives on the server, so signing back in restores it.

1. **Flush first** (`flushBeforeSignOut`, 8 s timeout): the outbox and `learner_state` go
   to the server. If something can't be sent (offline), the confirm sheet says "Some
   practice hasn't synced yet. Sign out anyway?" with **Wait** (stay signed in, keep
   retrying) and **Sign out anyway**.
2. `supabase.auth.signOut({ scope: 'local' })`.
3. **Wipe** (`resetDevice` in `sync/engine.ts`): learner store back to a new install's state
   (device settings stay), outbox, cached profile / cohorts / assignments / submissions /
   reviews, the welcome (`onboarded: false`, so the next person sees the welcome and track
   step), and the analytics identity (`reset()`). The persisted AsyncStorage / localStorage
   copies of the learner store and outbox are removed; the account store keeps only its
   emptied state.
4. `ensureSession()` quietly creates a new anonymous user (new uid, no data).
5. Signing back in is the "Existing account" flow above with a guest that has nothing to
   merge: `adoptOnSignIn` takes the account's progress from the server.

The same wipe runs if an account's session is revoked while signed in (SIGNED_OUT without
`signOut`). A guest that only loses its session keeps its practice: the next guest adopts it
(`anonymousId` hand-over), since that data was never an account's.

- Don't sign out an anonymous user who has progress unless they confirm. Their data is
  only reachable through that session, so signing out loses it. Offer "Save your
  progress" (upgrade) first. (The app only offers sign out to signed-in accounts.)

### Installs from before this change

These are devices with local guest data and no session. On first launch after the
update, call `signInAnonymously()`, then upload local `learner_state`, completions and
sessions under the new anonymous uid. That's the existing first-sign-in upload, run once.
After that, every flow above applies.

## API (AI routes)

`POST /api/roleplay/turn`, `/api/roleplay/debrief` and `/api/drill/feedback`:

- **Auth:** `Authorization: Bearer <access token>` is **required**, from either an
  anonymous or a permanent user. A missing token returns `401 auth_required`, and a bad
  one returns `401 invalid_token`. For a user who was deleted or banned, the token gets
  `401 invalid_token` when the quota is charged.
- **Quota:** the route validates the request, then calls `consume_ai_quota(bucket)` with
  the caller's own JWT, then calls the AI. Invalid requests (400/404) aren't charged.
  Successful responses include `X-Quota-Limit` and `X-Quota-Remaining`, both exposed
  through CORS.
- **Legacy:** `x-antelope-key` still works until **2026-10-25**, with a tiny per-IP quota.
  `ALLOW_LEGACY_APP_TOKEN=1` forces it on and `=0` turns it off. When the variable is
  unset, the legacy path closes itself after that date. It needs `APP_CLIENT_TOKEN` and
  the secret key. Remove it then (search for `TODO(2026-10-25)`).

Daily limits (UTC day) and burst limits, from `app_private.ai_quota_limits`:

| bucket | anonymous | permanent | legacy (per IP) |
|---|---|---|---|
| `turn` | 60/day, 12/min | 300/day, 20/min | 30/day, 10/min |
| `debrief` | 6/day, 2/min | 30/day, 3/min | 3/day, 1/min |
| `drill` | 40/day, 8/min | 200/day, 12/min | 15/day, 5/min |

There is also a global daily ceiling per bucket across all callers, in
`app_private.ai_global_limits`: turn 20000, debrief 1000, drill 10000. Change it with
SQL; no deploy needed.

### Error codes the client must handle

Every error body is JSON: `{ "error": "<human message>", "code": "<code>", ... }`. Show
`error` to the user; branch on `code`.

| HTTP | `code` | meaning | client action |
|---|---|---|---|
| 401 | `auth_required` | no bearer token | `signInAnonymously()`, then retry once |
| 401 | `invalid_token` | expired, forged, or the user was deleted | `refreshSession()` and retry once. If it fails again: sign out, then start a fresh anonymous session |
| 429 | `quota_exceeded`, `reason: "burst"` | too fast | wait `retry_after` seconds (also sent in the `Retry-After` header), then retry |
| 429 | `quota_exceeded`, `reason: "daily"` | daily limit hit (`limit`, `remaining: 0`) | show `error`. Anonymous users get a "Sign in with your email for more" message, so offer upgrade. Don't auto-retry |
| 503 | `ai_resting` | global ceiling hit ("Practice AI is resting") | show it. Retry after `retry_after` (UTC midnight) |
| 503 | `quota_unavailable` | quota check failed (DB down) | transient; retry with backoff |
| 503 | (no code) | AI not configured or upstream busy | existing handling |

`/api/account/merge-anonymous`:

| HTTP | `code` | meaning |
|---|---|---|
| 401 | `auth_required` / `invalid_token` | the bearer (permanent) token is missing or invalid |
| 403 | `account_required` | the bearer is itself anonymous |
| 400 | `anonymous_token_required` / `same_user` | bad body |
| 401 | `invalid_anonymous_token` | the guest token expired, was signed out, or its user is gone (also returned after a successful merge, since the guest is deleted). Terminal |
| 409 | `not_anonymous` | the "guest" token belongs to a permanent user (already converted). Terminal |
| 404 | `not_found` | the guest vanished mid-merge. Terminal |
| 503 | `merge_unavailable` | the server has no secret key. Retry later |
| 500 | `merge_failed` | retry |

PostgREST errors from Supabase calls: on `join_cohort`, `claim_trainer`, `create_cohort`
and submission inserts, an anonymous caller gets `code: '42501'` with
`hint: 'account_required'`. Treat it as "prompt to save progress with email", not as a
generic permission error.

## Analytics identity

- Anonymous users have a uid from the first launch. **Don't `identify` anonymous users.**
  Keep PostHog's device id, so a guest stays one anonymous person and person profiles
  don't fill with throwaway uids.
- Call `identify(uid)` on **conversion** (verifyOtp `email_change` succeeds). The uid
  stays the same, and PostHog links the earlier anonymous events to the person.
- On **existing-account sign-in**, call `identify(permanentUid)` as today. The
  anonymous uid is never identified.
- `signed_in` super property: true only for permanent users. Sign out calls `reset()` as
  today. The new anonymous session is not identified.
- `sign_in_completed.migrated_guest_data` stays: true when merge-anonymous moved anything.

## Hosted settings (Blake)

Do this when the anonymous-auth app release ships.

- **Auth > Sign In / Providers > Allow anonymous sign-ins**: on.
- **Auth > Sign In / Providers > Email > Confirm email**: **on**. Without it, anonymous
  users attach any unclaimed email with no code, which would let someone pre-claim
  another person's address. Turning it on doesn't change OTP sign-in. New users get the
  "Confirm signup" template, which already carries `{{ .Token }}`.
- **Auth > Email Templates > Change Email Address**: subject
  `Confirm your new email: {{ .Token }}`, body `supabase/templates/otp.html`.
- **Auth > Rate Limits > Anonymous users**: 30 per hour per IP (the Supabase default;
  `config.toml` matches). Lower it if farming shows up. The AI ceilings cap the bill
  either way.
- **Env (web, server only)**: `SUPABASE_SECRET_KEY` (Settings > API Keys > secret key),
  or the legacy `SUPABASE_SERVICE_ROLE_KEY`. Without it, merge-anonymous and the legacy
  path return 503.
- **CAPTCHA (later; needs client work)**: enable Cloudflare Turnstile under Auth > Attack
  Protection (CAPTCHA), or `[auth.captcha]` with `provider = "turnstile"` in `config.toml`. The app must then pass `options.captchaToken` to
  `signInAnonymously`, `signInWithOtp` and `updateUser`. On native, that means a
  WebView-hosted Turnstile widget. Do it when farming shows up in `ai_usage` or the
  breaker trips.
- **Stale anonymous users**: Supabase doesn't clean them up. Run this monthly, or from
  `pg_cron`:
  `delete from auth.users where is_anonymous and created_at < now() - interval '30 days' and id not in (select user_id from public.learner_state where updated_at > now() - interval '30 days');`
  Their rows cascade.

## Risks and limits

- **Farming:** anonymous sign-ins are cheap: 30 per hour per IP, multiplied by however
  many IPs an attacker controls. Per-user quotas bound each account, and only the global
  ceiling bounds the total. Turnstile is the next lever.
- **Revocation lag:** the AI routes verify JWTs locally with `getClaims`, which uses
  asymmetric keys. A signed-out token keeps working until it expires (at most 1 hour).
  Deleted and banned users are refused when the quota is charged.
- **Hot row:** every AI call increments one global counter row per bucket. That's fine
  at the current scale. If it ever contends, shard the row by minute.
- **Failed AI calls still use quota:** a unit is charged before the AI call, so an
  upstream failure uses up one.
- **Fail closed:** if the quota RPC can't be reached, the AI routes return 503 and the
  AI isn't called.
