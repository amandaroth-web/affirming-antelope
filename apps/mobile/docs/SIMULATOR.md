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

## API dev server

Practice AI routes live in `apps/web`: `npm run dev -w web` (port 3000, or 3001 if 3000 is taken). The simulator reaches it on localhost. Point the app at it with `EXPO_PUBLIC_API_URL=http://localhost:3001` set in the environment of the `expo start` process (restart Metro with `--clear` after changing it). Default is the dev machine LAN host on port 3000 (`src/lib/api.ts`).

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
