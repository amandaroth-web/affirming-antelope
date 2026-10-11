# Analytics privacy audit

Scope: every `track(` / `capture(` call in `apps/web` and `apps/mobile`, checked against the
privacy rules in `docs/tracking-plan.md`. Result: **no call site sends free text, emails,
names, transcripts, reflections, notes, or feedback.** Every property is an id (content id,
Supabase uuid), an enum, a number, or a boolean.

Backstops, in addition to review:

- `AnalyticsEvents` (`packages/core/src/analytics.ts`) types every property. There is no
  free-form `string` property that could hold prose, so `track("x", { text })` doesn't compile.
- `scrubProps` (same file) runs inside both `track` implementations. It drops strings over 64
  characters, nested objects, and arrays of anything but short strings.
- The website's click listener builds events only from `data-track-*` attributes with fixed
  patterns, never from link text or the DOM.
- Identity is the Supabase user uuid only. `identify` and person properties never receive an
  email or display name (`role`, `is_trainer`, `cohort_count`, `signed_up_at`).
- No autocapture (the SDK's own `$autocapture` / `$el_text` is off everywhere), no session
  replay, no feature-flag or survey calls.
- The app's web client strips `ph_did` / `ph_sid` from `$current_url` / `$referrer` before send.
- Without a key, or with Do Not Track / Global Privacy Control, nothing is initialised.

`$pageview` / `$screen` carry the URL or route path. Paths contain content ids, cohort ids and
submission ids (uuids) only; trainer sign-in carries `?next=<trainer path>`. No path or query
carries a name, email, or text.

## Website and trainer dashboard (`apps/web`)

| Call site | Event | Properties |
|---|---|---|
| `lib/analytics/dom.ts` (delegated click) | `cta_clicked` | `location` (validated slot name), `target` (`app`/`trainer`), `audience?` (enum) |
| `lib/analytics/dom.ts` (delegated click) | `guide_drill_clicked` | `slug`, `drill_id` (both validated `[a-z0-9_-]{1,64}`) |
| `lib/analytics/client.ts` `pageview()` via `components/analytics/analytics-provider.tsx` | `$pageview` | none of ours (SDK adds URL, referrer, UTM) |
| `components/trainer/sign-in-form.tsx` | `trainer_signed_in` | `is_new_user` (boolean). Also `identify(user.id)`, no person props yet |
| `app/trainer/(dashboard)/page.tsx` via `TrackOnMount` | `trainer_access_claimed` | none (fires on the `?welcome=1` redirect, once per tab session) |
| `components/trainer/create-cohort.tsx` | `cohort_created` | none |
| `components/trainer/join-code.tsx` | `join_code_copied` | none |
| `components/trainer/assignment-composer.tsx` | `assignment_created` | `item_count`, `kinds` (enum array), `due_in_days?` |
| `components/analytics/review-opened.tsx` (rendered by the submission page) | `review_opened` | `hours_since_submitted` |
| `components/trainer/review/feedback-panel.tsx` | `review_saved` | `rating?` (enum), `has_audio`, `has_recommendation`, `try_again`, `is_edit` |
| `components/analytics/trainer-identify.tsx` (dashboard layout) | `identify` | id = `viewer.id`; person: `role: 'trainer'`, `is_trainer: true` |
| `components/trainer/sign-out-form.tsx` | `reset` | none |

Super properties: `surface` (`website`/`trainer`), `platform: 'web'`, `signed_in`.

## Learner app (`apps/mobile`)

| Call site | Event | Properties |
|---|---|---|
| `lib/analytics.ts` `startAnalytics` | `app_opened` | `entry`, `src?` (validated slug) |
| `app/_layout.tsx` via `screenView` | `$pageview` (web) / `$screen` (native) | route pathname |
| `app/welcome.tsx` | `onboarding_chosen` | `choice` |
| `app/sign-in.tsx` | `sign_in_started` | `reason` |
| `sync/engine.ts` `signedIn` | `sign_in_completed` | `is_new_user`, `migrated_guest_data`. Also `identify(user.id)`; person: `role`, `is_trainer`, `cohort_count`, `signed_up_at` |
| `sync/engine.ts` `signedOut` | `signed_out`, then `reset` | none |
| `app/drill/[id].tsx` | `practice_started` | `kind`, `ref_id`, `skill`, `level`, `source` |
| `app/drill/[id].tsx` | `drill_answered` | `drill_id`, `skill`, `level`, `format`, `hit_target` |
| `app/drill/[id].tsx` | `drill_feedback_received` | `drill_id`, `latency_ms`, `move` (enum), `hit_target` |
| `app/drill/[id].tsx` | `next_step_chosen` | `from`, `choice` |
| `app/roleplay/[scenarioId].tsx` | `practice_started` | `kind`, `ref_id` (scenario id), `skill`, `source` |
| `components/roleplay/Conversation.tsx` | `roleplay_turn_sent` | `scenario_id`, `turn_index` (a count) |
| `components/roleplay/Conversation.tsx` | `roleplay_ended` | `scenario_id`, `learner_turns`, `ended_early` |
| `app/roleplay/[scenarioId].tsx` | `reflection_submitted` | `scenario_id`, `feeling` (`rough`/`mixed`/`solid`). The reflection text is never read |
| `app/roleplay/[scenarioId].tsx` | `debrief_viewed` | `scenario_id`, `latency_ms`, `suggested_next_step` (enum) |
| `app/roleplay/[scenarioId].tsx` | `next_step_chosen` | `from`, `choice` |
| `app/lesson/[id].tsx` | `practice_started`, `next_step_chosen` | `kind`, `ref_id`, `skill`, `source`; `from`, `choice` |
| `state/store.ts` `recordPractice` | `practice_completed` | `kind`, `ref_id`, `skill?`, `minutes`, `activity_id?`, `in_course` |
| `state/store.ts` `recordPractice` | `streak_extended`, `weekly_goal_hit` | `streak_days`; `target` |
| `app/join.tsx` | `cohort_joined` | `cohort_id` (uuid; the cohort name and join code are not sent) |
| `sync/engine.ts` `submitForReview` | `submission_created` | `kind`, `ref_id`. The note to the trainer is not sent |
| `sync/engine.ts` `withdrawSubmission` | `submission_withdrawn` | none |
| `app/review/[id].tsx` | `review_viewed` | `rating?` (enum), `has_audio`, `try_again`. Feedback text and audio are not sent |
| `lib/api.ts` | `ai_request_failed` | `endpoint` (derived from the path), `status` (HTTP code, 0 for no response). No request, response body, or error text |

Super properties: `surface: 'app'`, `platform` (`web`/`ios`/`android`), `app_version`, `signed_in`.

Not mine: `Debrief.tsx` has an unrelated local function named `track` (scroll-section layout
tracking). It never leaves the screen.

## Known gaps against the plan

- `drill_answered` for text drills fires when the coach's reply arrives (the plan puts
  `hit_target` on it, and it isn't known earlier). If the AI call fails, only
  `ai_request_failed` fires.
- `practice_completed` has no `source`, per the plan's table, so the "Content" dashboard's
  "`practice_completed` with `source = guide`" needs to join through `practice_started.source`.
- `ai_request_failed` is not sent for user-initiated aborts or request timeouts (both surface
  as `AbortError`).
