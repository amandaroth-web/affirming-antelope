# Affirming Antelope mobile: design system

Read this before you build a screen. It covers the system the drill, role-play, reflection and debrief screens should extend. Brand source of truth: `/BRAND.md`.

## Principles

- **One primary action per screen.** It's a cobalt `Button` (ALL CAPS, short: START, CONTINUE, SUBMIT). Everything else is secondary (white, sentence case) or a quiet link.
- **Raised, not shadowed.** Surfaces sit on a solid 4 to 6pt bottom shadow in the darker related token. Pressed controls lose the shadow and move down. Never use blurred drop shadows, gradients, or glass.
- **Cobalt means learning, ochre means achievement.** Ochre (`gold`) is for checks, streaks, completed levels, and celebration. It is never a CTA colour.
- **Sentence case everywhere.** ALL CAPS only for short primary button labels (the Button component handles this).
- **The mascot shows up only when it has something to say:** guidance, encouragement, completion, or an empty state. It isn't decoration.
- **Coach voice:** direct, specific, encouraging. "One short drill." not "Supercharge your skills!"

## Tokens: `src/design/tokens.ts`

| Token | Use |
|---|---|
| `color.primary` #4F6BED / `primaryShadow` #374FBF | actions, active states / pressed + bottom shadow of cobalt |
| `color.gold` #E8A638 / `goldShadow` #B97914 / `goldTint` | achievement only |
| `color.soft` #EEF1FF, `softDeep` | learning surfaces, selected states, tracks |
| `color.line` #DFE3F2 / `shadow` #CBD1E5 | 2pt borders / bottom shadow of white surfaces |
| `color.ink` / `muted` / `faint` | body text / secondary text / locked glyphs only (not text you need to read) |
| `color.navy` | illustration contours, rare dark surfaces (Challenge me card, tooltips) |
| `space[1..10]` | 4pt grid. Screen gutter is `layout.gutter` (20) |
| `radius.surface` 20, `radius.illustration` 32, `radius.md` 16 (buttons) | |
| `moveColor.*` | learner-move families: `question` cobalt, `reflection` teal, `support` navy, `inconsistent` terracotta, `neutral` faint. Always paired with a shape (`MoveMarker`) |
| `zone.*` | replay-chart bands: `change` (soft), `mixed` (white), `hold` (warm sand) + `holdInk` |
| `tone.*` | `{face, border, shadow, ink}` sets: primary, surface, soft, gold, navy, onPrimary, locked |
| `type.*` | hero/title/heading/subheading/number = Fredoka. body/bodyStrong/label/caption/overline/button = Nunito |

## Components: `src/design` (import from `@/design`)

- `Text`: the only text component. `variant`, `color`, `align`. It caps Dynamic Type for each variant, so layouts don't break.
- `PressableSurface`: the 3D press primitive. `tone`, `depth`, `radius`, `haptic` ('press' | 'tick' | false), `pressScale`, `contentStyle` (the face). `Raised` is the static version.
- `Button`: `variant` primary | secondary | onPrimary (white on a cobalt card), `size` lg/md/sm, optional `icon`. Hit targets are at least 44pt.
- `Card`: a raised surface. Pass `onPress` to make it pressable. **Never nest a Button inside a pressable Card** (on web that renders a button inside a button).
- `Chip`: non-interactive label (soft, primary, gold, neutral, locked, onPrimary).
- `ProgressRing`: SVG ring that springs to `value` (0..1). `onFilled` fires once on landing (pair it with `haptic.success`).
- `LevelPips`: six-step skill level (`level`, `percent`, `state` progress/complete/locked). The pips fill on a 45ms stagger.
- `BottomSheet`: gesture-driven modal. Drag down or flick to dismiss, drag up to rubber-band, and the backdrop dims with position. `open` / `onClose`. Keep content short (the sheet doesn't scroll).
- `SegmentedControl`: raised white thumb that slides on a periwinkle track. Segments take a `hint` second line.
- `Switch`, `Avatar` (deterministic from `persona.avatarSeed`, flat with the navy contour, same seed gives the same person), `Hoofprint` (the streak and track motif; antelopes leave tracks, not flames), `Screen` (safe area plus tab-bar padding).
- Icons: Phosphor, re-exported from `@/design/icons`. Use `weight="bold"` for UI and `"fill"` for active. Never emoji.
- `haptic.tick | press | thud | success | warn`. Fire it on the visual peak (press-in, snap, landing), never on a timer. It respects the Me > Haptics setting and does nothing on web.

## Motion: `src/motion`

- Springs (`spring.*`): **snappy** (press-in, toggles, indicators), **release** (spring back with a little overshoot), **gentle** (entrances, sheets), **bouncy** (celebration, icon pops, hops), **settle** (rings, precise stops). Prefer springs over timed easing. Use `withTiming` only for authored loops (breathing, pulse) and cross-fades.
- `useEntrance({ index, delay, from })` / `<Enter index={n}>`: staggered (`STAGGER` = 45ms) rise-in. Under reduced motion it becomes a 180ms fade.
- `RollingNumber`: odometer counter. Digits land right to left.
- `usePressScale()`: press feedback for flat rows and icons.
- `useReduceMotion()`: OS setting OR Me > Reduce motion. **Every new animation must have a reduced path**: same end state, no travel, cross-fade at most.
- Run everything on the UI thread (shared values, `useAnimatedStyle` / `useAnimatedProps`). JS-thread animation loops aren't allowed. Read shared values directly inside each worklet, or through `useDerivedValue`. Reanimated web doesn't pick up shared values that are read through a nested worklet helper (see `components/path/Trail.tsx`).
- Use `scheduleOnRN` from `react-native-worklets` (not `runOnJS`) to call back into React.

## Mascot: `src/components/mascot`

```tsx
<Mascot pose="wave" | "celebrate" | "head" mood="idle" | "listening" | "cheer" size={120}
        greet paused={!isFocused} flip ref={handle} />
handle.current?.wave() | hop() | turn()
```

- `size` is height in pt. Breathing is anchored at the feet. Blinks are randomized (sometimes double) using three hand-drawn lid frames. `greet` waves once after mount. Changing `pose` squashes, swaps at the bottom of the squash, then stretches and settles. `cheer` hops every 2.4s. `listening` leans in and blinks less.
- Pass `paused={!useIsFocused()}` from screens. The mascot also pauses when the app is backgrounded.
- Artwork lives in `assets/mascot/rig/` and is generated by `python3 scripts/build-mascot-rig.py`. The script deepens colours to match the landing page and writes `rig.generated.ts`. Don't edit that output by hand.
- Rive later: implement `MascotProps` / `MascotHandle` (`types.ts`) and swap the export in `index.ts`.
- Suggested moods: drill feedback uses `head`/`listening`, a correct answer triggers `hop()`, and debrief completion uses `celebrate`/`cheer`.

## State: `src/state/store.ts` (zustand, persisted to AsyncStorage)

Seeded from `DEMO_LEARNER` in `@antelope/core`. Actions for the practice loop:

- `recordPractice({ kind, skill?, refId?, activityId?, minutes })` updates the streak, weekly goal, skill progress and assignment items. When `activityId` is set it also calls `completeActivity`, which advances the path week once every activity in the unit is done.
- `completeActivity(activityId)`, `submitForReview({ scenarioId, turns, selfReflection?, note? })`.
- Selectors: `useCurrentUnit`, `nextActivity`, `useProgressRows` (`state/selectors.ts`).

## Practice-loop routes: `src/data/routes.ts`

`openDrill(id, {activityId?, minutes?, source, replace?})`, `openRoleplay(scenarioId, …)`, `openLesson(id, {activityId?, minutes?, replace?})`, `openActivity(pathActivity, source, {replace?})`, `pickDrill(skill, level)`, `pickScenario(skill)`, `findActivity(activityId)`, `nextDrillId(current, done, activityId?)`. Use `replace: true` when one practice screen leads to another (debrief "Try a harder scenario", lesson "Start next") so Close still returns to where the learner started. The three practice screens are stack screens over the tabs (`slide_from_bottom`), close X top left, one primary action docked at the bottom.

## Practice loop: `src/components/practice-loop` (shared)

- `SessionHeader` (close X + centre + trailing slot, safe top), `Dock` (bottom bar above the home indicator), `KeyboardColumn` (KeyboardAvoidingView `padding` on iOS/Android, plain column on web; Expo Go safe, no keyboard-controller), `sessionStyles`.
- `Speech`: `LearnerBubble` (cobalt, raised on deep cobalt, tail bottom right), `EmployeeBubble` (white raised, persona `Avatar`, tail bottom left; children replace text, e.g. `TypingDots`), `useBubbleEntrance(side, delay, skip)` (rise + scale from the speaker's side), `SpeechCard` (drill line: avatar pops on `bouncy`, bubble rises after it), `InstructionChip` (the task, target glyph), `CoachSays` (mascot + bubble = coach voice), `PossibleResponse` ("One possible MI-consistent response", never "correct").
- `Composer`: multiline, grows to 132pt then scrolls, focus ring cross-fades to cobalt, the send button wakes with a spring pop when there's text. Web: Enter sends, Shift+Enter adds a line.
- `Thinking`: `Shimmer` (a band sweeping a soft track: working, no fake percent), `RotatingLine` (cross-faded coach lines), `CoachThinking` (listening antelope + both).
- `Completion`: `usePracticeSnapshot()` captures streak/goal on mount; `PracticeTicks` rolls the streak (`RollingNumber` from → to) and advances the weekly ring (ochre + success haptic when the goal lands); `CompletionMoment` = celebrating antelope (cheers ~3s, then idles) + ticks + actions.
- `ConfirmSheet` (keep-going choice primary, leaving choice secondary, never red). `useKeyboardHeight()` for inputs inside sheets (Modal), where KeyboardAvoidingView doesn't reach.
- `moves.ts`: plain-language move names (`MOVE`, `movePhrase()` → "an open question" / "sharing information"), families (`FAMILY`: questions ● circle, reflections ◆ diamond, affirm & autonomy ■ square, telling or pushing ▲ triangle), zones ("Open to change" / "Mixed" / "Holding on"), `TALLY_ROWS`. `MoveMarker` renders a family's shape + colour everywhere (chart, legend, tallies).
- `errors.ts`: `friendlyError()` (offline / slow / busy / our fault, coach voice; always "your response is saved") and `withTimeout(ms)`.

## Lesson: `app/lesson/[id].tsx`, `components/lesson/CardStack.tsx`

Physical card stack. The top card follows the finger (rotation from distance + a spring-smoothed tilt from drag velocity), ticks a haptic at the point of no return, and either springs back (`release`, carrying velocity) or flies off carrying the flick. Cards underneath rise and scale toward the next slot as you drag; their words fade in as they surface. Either direction advances; Back flies the previous card in from the left while the current one recedes. NEXT drives the same flight. Progress dots: the current one stretches into a pill. Examples render as a "You might say" speech snippet. Reduced motion: no travel; a swipe or NEXT cross-fades. Finish → `CompletionMoment` → next activity in the unit (`START NEXT`, replace) or back.

## Drill: `app/drill/[id].tsx`, `components/drill/*`

Header: "Day N" (streak including today) + "N minutes of MI practice today", and a rep counter (hoofprint + rolling count that pops). Setup: skill/level chips, `SpeechCard`, `InstructionChip`.
- **Choices (level 1):** `ChoiceTiles`. Tap selects (tick haptic, soft face, cobalt edge, letter badge pops); multi-target drills toggle ("Pick all that apply"). CHECK reveals: targets turn ochre with a check that pops, picks resolve first, every tile opens its explanation on a stagger, others dim slightly. Nothing is marked wrong. The coach reacts (hop + success haptic on a hit).
- **Free text:** docked `Composer`. Send → your words appear as a cobalt bubble, the antelope listens beside a shimmer (≥1.1s so the moment lands). `FeedbackPanel` rises on `gentle` over a light scrim: chip ("Did what the drill asked" ochre / "Worth another pass" soft), "That's a complex reflection." / "That landed as a closed question.", observation, what worked, possible responses, try next. Errors keep the text: TRY AGAIN or edit.
- "One more" chains the course activity's drills, then `DAILY_DRILL_ORDER`. The session is recorded once, on the first finished rep (closing early never loses it). "I'm done" → `CompletionMoment`.

## Role-play: `app/roleplay/[scenarioId].tsx`, `components/roleplay/*`

`RoleplayFlow` phases: brief → chat → reflect → thinking → debrief, each arriving with a short rise (`PhaseFade`; cross-fade when reduced). Keyed by scenario so a replaced screen starts fresh.
- `Brief`: persona, context + difficulty chips, situation, "Your goal" card with target skills, "How it works". START CONVERSATION.
- `Conversation`: opening line is there immediately (no API call). `useEmployeeReply` streams `/api/roleplay/turn`: a read-pause scaled to your message, typing dots (header says "typing…"), then a word-at-a-time reveal from a buffer at ~46 chars/s (speeds up if the stream runs far ahead), so chunk sizes never show. Streamed replies don't re-enter when they settle. Auto-scroll follows unless you've scrolled up; then a "New reply" pill. "Your goal" folds away after your first reply (spring height). End stays quiet until 3 replies, then turns cobalt with a pop + tick; earlier ends go through a `ConfirmSheet`. Close asks before discarding. No live score.
- `Reflection` (before any AI feedback): Rough / Mixed / Solid tiles (weather icons, check badge, icon hop); the antelope's pose and line change with the choice; optional "What would you do differently?". SUBMIT starts the debrief request (the reflection goes with it); `CoachThinking` holds ~2.4s minimum with rotating lines. Errors keep everything.
- `Debrief`: coach answers your read first (celebrates when the trajectory rose), compact `PracticeTicks`, then:
  - `ReplayChart` (signature): monotone cubic through `trajectory` over plain-language bands, traced left→right with `strokeDashoffset`; employee replies are hollow rings, your moves are filled family markers between them (key moments ringed ochre), each popping on `bouncy` as the trace reaches it. Drag or tap: a guide line, halo and a callout (your line, their reply, observer notes) follow on springs with a light haptic per point. After the trace it settles on the first key moment. "List" toggles an accessible exchange list.
  - `MovesPanel`: rolling counters per move (dashed when zero) and a reflections-vs-questions balance beam that tips on a soft spring. A balance, not a grade.
  - Strengths, `KeyMoments` (snapping horizontal cards, next one peeks, ochre dot tracks scroll on the UI thread), Try next, What next (try again / practice this skill / harder / easier / new; coach's pick highlighted and docked as the primary), `ReviewSheet` (exactly what's shared and what isn't, optional note, `submitForReview` incl. the debrief, "Sent to Dr. Rosa Lin" with a check pop).

## Rules for the practice loop

- AI is never the authority: "One possible MI-consistent response", "That landed as…", no numeric scores, no grades, no red or X marks. `hitTarget` means "did what the drill asked".
- Self-reflection before AI feedback. The antelope is the coach; the employee is a person with an `Avatar` (the mascot never plays them).
- Every ending offers a way on (try again / practice this skill / harder / new). Trainer review is opt-in per session and says what's shared.
- **Don't:** use emoji, purple gradients, blurred shadows, centred-everything layouts, walls of identical cards, scores or percentages for skills (use levels), or leaderboards.
