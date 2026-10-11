# Simulator workflow (iOS dev build)

The app runs as an Expo **dev client** (not Expo Go) because Rive needs native code.
`ios/` and `android/` are prebuild output and gitignored; never hand-edit them. Change native config in `app.json` (plugins, `expo-build-properties`).

Simulator: **iPhone 18 Pro**, UDID `CA4A5370-77E3-429B-AABA-05CD94AD9DB6`, 402x874 points. App scheme `antelope`, bundle id `com.anonymous.affirming-antelope`.

Always `export LANG=en_US.UTF-8` before CocoaPods or Expo commands.

## Start / restart

```sh
cd apps/mobile
xcrun simctl boot CA4A5370-77E3-429B-AABA-05CD94AD9DB6   # no-op error if already booted
npx expo start --dev-client --port 8081                    # Metro (keep running; JS edits hot reload)
```

Relaunch the installed app without rebuilding (JS-only changes never need a rebuild):

```sh
scripts/sim-capture.sh relaunch
# = terminate + launch com.anonymous.affirming-antelope, then attach the dev client to Metro:
#   xcrun simctl openurl booted "antelope://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

Gotchas:
- A plain `simctl launch` shows the dev launcher; the attach `openurl` is what loads the bundle (about 8s).
- Foregrounding a running app with `simctl launch` can leave it on a cached bundle ("bundle scheme is file" in the Metro log): fast refresh and logs stop. `relaunch` fixes it.
- After `idb ui text` the simulator treats input as a hardware keyboard and stops showing the software keyboard; reboot the sim (`xcrun simctl shutdown` / `boot`) or use the second sim to check keyboard layouts.
- **Adding or renaming a route file needs `relaunch`**; fast refresh alone leaves the deep link "Unmatched Route".
- The dev-menu floating "Tools" button is turned off in this simulator (`defaults write com.anonymous.affirming-antelope EXDevMenuShowFloatingActionButton -bool false`) so it does not appear in captures. A red/yellow dev overlay still can; dismiss with a tap on its Dismiss button (bottom-left, about 45,718).
- Screenshots are 1206x2622 px (3x). Read a downscaled copy, not the raw PNG: `ffmpeg -y -i x.png -vf scale=300:-1 -q:v 5 small.jpg`.

Full rebuild only when native deps or `app.json` plugins change (about 5 min cold): `npx expo run:ios --device CA4A5370-77E3-429B-AABA-05CD94AD9DB6 --no-bundler` (`npx expo prebuild --platform ios` regenerates `ios/` from config first; it wipes `ios/`).

iOS 27 crashes at launch unless the app adopts the UIScene life cycle. SDK 57's template doesn't, so `plugins/with-ios-scene-lifecycle.js` (listed in `app.json`) patches the generated `AppDelegate.swift` and `Info.plist` the way SDK 58's template does. Drop it after upgrading to SDK 58.

## Deep-link routes (expo-router)

`scripts/sim-capture.sh open <path>` runs `xcrun simctl openurl booted antelope://<path>`.

| Path | Screen |
| --- | --- |
| `/` | Home tab (Today) |
| `/path` | Path tab |
| `/practice` | Practice tab |
| `/me` | Me tab |
| `/drill/<drillId>?source=practice` | Drill, e.g. `drill-oars-01`, `drill-engaging-01`, `drill-evoking-01`, `drill-discord-01`, `drill-full-conversation-01` |
| `/roleplay/<scenarioId>?source=practice` | Role-play, scenario ids `EN-003`, `PM-017`, `BO-008`, `CR-012`, `DC-021` |
| `/lesson/<lessonId>` | Lesson, e.g. `lesson-u01-what-mi-is`, `lesson-u01-oars`, `lesson-u02-spirit` ... `lesson-u12-staying-steady` |

Optional params: `activityId`, `minutes`, `source` (`today|path|assignment|practice|challenge`). Full id lists live in `packages/core/src/{drills,lessons,scenarios}.ts`; route contract in `src/data/routes.ts`.

## Analytics (PostHog)

Contract: `docs/tracking-plan.md`. Facade: `src/lib/analytics.ts` (posthog-js on web, posthog-react-native on iOS/Android). With no key it is a no-op, so local dev sends nothing.

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_POSTHOG_KEY` | The project's public `phc_...` key. Leave unset locally. Baked into EAS builds via `eas.json` (`preview`, `production`); the web export for app.affirmingantelope.com needs it in that host's build environment. |
| `EXPO_PUBLIC_POSTHOG_HOST` | Ingest host. Default `https://affirmingantelope.com/ingest` (the website proxies it to PostHog). To test locally, point it at a catcher or at `http://localhost:3000/ingest`. |

Test the payloads without touching the real project: set a fake key and a local host, then run the web build, e.g. `EXPO_PUBLIC_POSTHOG_KEY=phc_test EXPO_PUBLIC_POSTHOG_HOST=http://localhost:9999 npm run web -w mobile`.

Website guides deep-link with `https://app.affirmingantelope.com/drill/<drillId>?src=guide_<slug>`. `src` labels `app_opened` (`entry: 'guide'`), and the first practice that launch starts is `practice_started` with `source: 'guide'`. Never add free text to an event: ids, enums and counts only.

## Capture

All output goes to `apps/mobile/docs/motion/`; frames and contact sheets go to the session scratchpad (`$SIM_SCRATCH`, default baked into the script).

```sh
scripts/sim-capture.sh shot home                  # docs/motion/home.png
scripts/sim-capture.sh record intro 4             # 4s h264 -> docs/motion/intro.mp4
scripts/sim-capture.sh frames intro 10            # frames/<name>/f0001.jpg ... + frames/<name>-sheet.jpg (<80KB)
scripts/sim-capture.sh gif intro                  # docs/motion/intro.gif (<=3MB, 30fps, 390px; degrades if too big)
scripts/sim-capture.sh open drill/drill-oars-01   # deep link
scripts/sim-capture.sh relaunch                   # restart app, attach to Metro
scripts/sim-capture.sh tap 200 800                # points, not pixels (idb)
scripts/sim-capture.sh swipe 200 600 200 200 0.3  # x1 y1 x2 y2 [seconds]
```

Targeting another simulator: every command honours `SIM_UDID=<udid>` (default `booted`; with several sims booted and no `SIM_UDID`, the script uses the iPhone 18 Pro above). `METRO_PORT` picks the Metro the `relaunch` attaches to, and `CROP=w:h:x:y` (pixels) crops `frames`/`gif`. A second sim (iPhone 18 Pro Max, `9D074415-B65F-43D2-970B-6E757200E0DC`, 440x956 pt) can run the same dev build (`xcrun simctl install <udid> ~/Library/Developer/Xcode/DerivedData/AffirmingAntelope-*/Build/Products/Debug-iphonesimulator/AffirmingAntelope.app`) against its own Metro (`npx expo start --dev-client --port 8082`; `SIM_UDID=... METRO_PORT=8082 scripts/sim-capture.sh relaunch`). Its idb companion uses port 10883.

`tap`/`swipe` use idb (`fb-idb` via `pip3 install --user`; `idb_companion` unpacked from the Homebrew bottle into `~/.local/idb-companion` because `brew install` refuses with the outdated Command Line Tools). The script starts the companion on port 10882 on first use. If it breaks, `pkill idb_companion` and retry; fallback is deep links only.

Typical motion loop: start `record` in the background, fire `open`/`tap`, wait, then `frames` and view the contact sheet.

## Backend: Supabase (accounts, sync, cohorts, trainer review)

The app talks to Supabase directly (`src/lib/supabase.ts`, `@supabase/supabase-js`, session in AsyncStorage). Guest mode needs none of this; everything below is for signed-in flows.

- **Env** (in the environment of the `expo start` process; restart Metro with `--clear` after changing):
  - `EXPO_PUBLIC_SUPABASE_URL`: the API URL. Unset in a dev build: the dev machine's LAN host from the Expo `hostUri` on port **54321** (same derivation as the AI API in `src/lib/api.ts`), so the simulator and a phone on the same Wi-Fi both reach `supabase start`. Falls back to `http://127.0.0.1:54321`.
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the publishable (anon) key. Unset in a dev build: the local stack's public default `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`.
  - Release builds with neither set have no backend: the Account section hides and the app is guest-only. For EAS builds set both in EAS environment variables.
- **Local stack:** `npm run db:start` from the repo root (Docker). Studio http://127.0.0.1:54323, Postgres `127.0.0.1:54322` (postgres/postgres), Mailpit http://127.0.0.1:54324. `npm run db:reset` restores the seed. Contract: `docs/data-model.md`.
- **Sign-in codes** land in Mailpit. From a script: `curl -s 'http://127.0.0.1:54324/api/v1/messages?limit=20'` (the subject is "Your Affirming Antelope code: 123456"; filter on `To[0].Address`). The code screen shows this hint only in native dev builds pointed at a local stack.
- **Seed accounts:** amanda@example.com (learner in "MI for Leaders — Fall pilot", PM-017 submitted), jordan@, priya@, marcus@ (EN-003 reviewed), rosa@example.com (trainer Dr. Rosa Lin). Join code `MIL-DEMO`, trainer code `TRAIN-PILOT`.
- **Acting as the trainer** (to test the inbox): get Rosa a token with `POST /auth/v1/otp` + `POST /auth/v1/verify` (`{"email","token","type":"email"}`, `apikey` header), then `POST /rest/v1/reviews` with `submission_id`, `feedback`, `rating` (`emerging|developing|proficient|strong`), `recommended_kind`/`recommended_ref`, `try_again`. Voice notes go to `POST /storage/v1/object/review-audio/{cohort_id}/{submission_id}/{uuid}.m4a` (`content-type: audio/mp4`; `say -o note.m4a --file-format=m4af --data-format=aac "…"` makes one) and the review's `audio_path`. Pull to refresh Home, or background and foreground the app.
- **Offline:** Me › Demo › **Simulate offline** (dev builds, any account) makes every Supabase request fail like a dropped connection. Practice queues in the outbox (Me › Account shows "N waiting to sync"); switch it off and the outbox flushes. The simulator shares the Mac's network, so this is the practical way to test it; it also survives a JS reload only until the app restarts (it's not persisted).
- **Fresh install** (to see the welcome, or test a first sign-in): `xcrun simctl uninstall $SIM_UDID com.anonymous.affirming-antelope && xcrun simctl install $SIM_UDID ~/Library/Developer/Xcode/DerivedData/AffirmingAntelope-*/Build/Products/Debug-iphonesimulator/AffirmingAntelope.app`, re-set the floating-button default above, then `scripts/sim-capture.sh relaunch`. The dev menu opens once on first launch; close it (X near 360,419).
- **Typing in tests:** `idb ui text --udid $SIM_UDID "…"` types into the focused field. It can drop the first characters while a field is still focusing, so wait about a second after the tap (or lead with two spaces where the app trims). `idb ui key-sequence 42 42 …` is backspace.
- **Realtime:** `reviews` and `submissions` are in the `supabase_realtime` publication, so a review Rosa saves (or a submission made on another device) shows up on Home / Me within a second, no refresh. RLS limits events to the learner's own rows.

Native modules added for accounts (need a dev-client rebuild, all Expo Go compatible): `expo-audio` (voice notes; config plugin with `microphonePermission: false`), `expo-network` (reconnect → flush), `expo-crypto` (uuid client ids). No URL polyfill is needed on RN 0.86.

## API dev server

Practice AI routes live in `apps/web`: `npm run dev -w web` (port 3000, or 3001 if 3000 is taken). The simulator reaches it on localhost. Point the app at it with `EXPO_PUBLIC_API_URL=http://localhost:3001` set in the environment of the `expo start` process (restart Metro with `--clear` after changing it). Default is the dev machine LAN host on port 3000 (`src/lib/api.ts`).

For app testing without model calls, run a second, mocked server on its own port and point Metro at it:

```sh
cd apps/web && AI_MOCK=1 npx next dev -p 3007        # deterministic canned replies
cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:3007 \
  npx expo start --dev-client --port 8081 --clear
```

Every AI call sends `Authorization: Bearer <access token>`: guests are anonymous Supabase users, created on first launch (see below), so the API needs a reachable Supabase stack. Quotas apply in mock mode too.

## Rive

`@rive-app/react-native` 0.5.4 (Rive RN 2.0, Nitro; the old `rive-react-native` is the legacy package) plus `react-native-nitro-modules` 0.36.x (peer range is `<0.37`); native pod `RiveRuntime` 6.28.0. No config plugin needed. Needs the dev build, not Expo Go.

Assets in `assets/rive/` (`.riv` is registered in `metro.config.js` assetExts):

```tsx
const { riveFile } = useRiveFile(require('../../assets/rive/mascot-wave.riv'));
<RiveView file={riveFile} fit={Fit.Contain} autoPlay stateMachineName="State Machine 1" style={{ width: 200, height: 300 }} />
```

- `stateMachineName="State Machine 1"` is required; without it the runtime logs "Could not create state machine with name ''" as a red box.
- `mascot-wave.riv`: artboard `Mascot Wave` (674x978), one looping `idle` animation (arm wave + blink, 180 frames @ 30fps), state machine `State Machine 1` (entry -> idle), no inputs.
- `mascot-celebrate.riv`: artboard `Mascot Celebrate` (703x914), contains only the two eyelid layers (`lidL`, `lidR`), a blink overlay that is invisible alone; `idle` (180 frames @ 30fps), state machine `State Machine 1`, no inputs. Meant to sit over a separate body image.
- `mascot-coach.riv`: the app's mascot (artboard `Coach`, state machine `Coach`, view model `Coach`); contract in `DESIGN.md` › Mascot. Built by `apps/web/scripts/mascot-coach-build.mjs`.
- The default (new) iOS backend does **not** support state-machine inputs (`setNumberInputValue`/`triggerInput` throw "SMI inputs are not supported by the new runtime"). Drive state machines through view-model data binding (`useViewModelInstance(file, { async: true })` + `dataBind={instance}`).
- Mascot playground (dev only): `antelope://dev/mascot?pose=wave&mood=idle&size=300&fire=wave&at=600&chrome=0` (`fire`: wave, hop, turn, cheer, nod, blink; change `n` to re-fire).

## API auth (Supabase bearer; guests are anonymous users)

Design: `docs/anonymous-auth.md`. On first launch the app calls `signInAnonymously()` quietly (`src/sync/anonymous.ts`; retried with backoff, on foreground and before an AI request while offline). `src/lib/api.ts` always sends `Authorization: Bearer <access token>`, refreshing once on a 401. There is no app token any more: `EXPO_PUBLIC_APP_TOKEN` / `x-antelope-key` are gone from the app (the API still accepts the old header until 2026-10-25 for older builds).

- Sign in from a guest: a new email converts the same user (`updateUser({ email })` + `verifyOtp` `email_change`); an email that already has an account signs in to it and the engine calls `/api/account/merge-anonymous` with the guest token kept before switching.
- Practice limits: `429 quota_exceeded` / `503 ai_resting` show coach-voice copy (`components/practice-loop/errors.ts`); a guest at the daily limit gets "Save my progress with email".
- Test the limits locally by editing `app_private.ai_usage` (e.g. `update app_private.ai_usage set count = 40 where bucket = 'drill'`), and an offline first launch by stopping the stack's API gateway (`docker stop supabase_kong_<project_id>`).
