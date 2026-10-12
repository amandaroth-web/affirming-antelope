import { useEffect, useState, type RefObject } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SaveProgressLink } from '@/components/practice-loop/ErrorBits';
import { Shimmer } from '@/components/practice-loop/Thinking';
import { ArrowCounterClockwiseIcon, IconButton, KeyboardIcon, MicrophoneIcon, Text, XIcon, color, haptic, radius, space } from '@/design';
import { FADE_MS, spring, useReduceMotion, useTickSwap } from '@/motion';
import type { VoiceTurn } from './useVoiceTurn';
import { MAX_RECORDING_MS, SOFT_CAP_MS } from './voiceSupport';

const MIC = 80;
const DEPTH = 5;
/** How far you slide (up, or sideways) before letting go cancels. */
const CANCEL_AT = 84;

/**
 * Talk mode's composer slot: one big hold-to-talk mic.
 *
 *   press      the face drops onto its shadow (3D press, snappy) with a press haptic; recording starts
 *   hold       a soft cobalt ring breathes behind the mic and swells with your voice (recorder metering,
 *              written to a shared value ~16×/s, drawn on the UI thread); "Listening…" and a timer.
 *              From 50s the timer warms and counts down; at 59s it sends by itself.
 *   slide      up or sideways: a "Slide up to cancel" chip rises above the mic and fills warm as you go;
 *              past 84pt it ticks and reads "Release to cancel", and the mic shrinks a little
 *   release    sends (or cancels past the line). The face springs back with the release overshoot
 *   then       a short shimmer while the words are read, then your bubble launches out of the mic
 *   speaking   "Len is talking. Hold to cut in." Pressing interrupts.
 * Reduced motion: no travel or swelling; the ring cross-fades with the level and the press is instant.
 * Screen readers: double-tap to start, double-tap again to send (holding isn't practical there).
 */
export function TalkDock({
  voice,
  name,
  onType,
  micRef,
  disabled,
}: {
  voice: VoiceTurn;
  /** Can't speak right now (the last reply failed and is waiting on Resend). */
  disabled?: boolean;
  /** The persona's call name ("Len", "Ms. Alvarez"). */
  name: string;
  onType: () => void;
  micRef: RefObject<View | null>;
}) {
  const reduce = useReduceMotion();
  const { state, notice, since, level, press, release, cancel, retry } = voice;
  const can = (state === 'idle' || state === 'speaking') && !disabled;
  const [armedRaw, setArmedJS] = useState(false);
  // only meaningful mid-take (derived, not reset in an effect)
  const armedJS = armedRaw && state === 'recording';
  const sr = useScreenReader();

  const live = useSharedValue(can ? 1 : 0);
  const down = useSharedValue(0);
  const drag = useSharedValue(0);
  const armed = useSharedValue(0);
  const holding = useSharedValue(0);
  const rec = useSharedValue(0);
  const breathe = useSharedValue(0);
  // the face goes quiet while the words are read and the reply is on its way; held, it stays cobalt
  const quiet = !can && state !== 'recording';
  const off = useSharedValue(quiet ? 1 : 0);

  useEffect(() => {
    live.value = can ? 1 : 0;
    off.value = withTiming(quiet ? 1 : 0, { duration: FADE_MS });
  }, [can, quiet, live, off]);

  useEffect(() => {
    const on = state === 'recording';
    rec.value = withTiming(on ? 1 : 0, { duration: on ? 120 : 220 });
    if (on && !reduce) breathe.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    else {
      cancelAnimation(breathe);
      breathe.value = withTiming(0, { duration: 200 });
    }
  }, [state, reduce, rec, breathe]);

  useAnnounce(state, name, notice?.text);

  const onDown = () => {
    setArmedJS(false);
    haptic.press();
    press();
  };
  const onUp = (cancelled: boolean) => {
    if (cancelled) {
      haptic.tick();
      cancel();
    } else release();
  };
  const onCross = (past: boolean) => {
    haptic.tick();
    setArmedJS(past);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      if (!live.value) return;
      holding.value = 1;
      down.value = reduce ? 1 : withSpring(1, spring.snappy);
      scheduleOnRN(onDown);
    })
    .onUpdate((e) => {
      if (!holding.value) return;
      const d = Math.max(-e.translationY, Math.abs(e.translationX) * 0.8, 0);
      drag.value = Math.min(1.25, d / CANCEL_AT);
      const past = d >= CANCEL_AT ? 1 : 0;
      if (past !== armed.value) {
        armed.value = past;
        scheduleOnRN(onCross, past === 1);
      }
    })
    .onFinalize(() => {
      if (!holding.value) return;
      holding.value = 0;
      const cancelled = armed.value === 1;
      armed.value = 0;
      drag.value = reduce ? 0 : withSpring(0, spring.release);
      down.value = reduce ? 0 : withSpring(0, spring.release);
      scheduleOnRN(onUp, cancelled);
    });

  const warm = useDerivedValue(() => withTiming(armed.value, { duration: 120 }));

  const faceStyle = useAnimatedStyle(() => {
    const k = Math.min(1, drag.value);
    return {
      backgroundColor: interpolateColor(off.value, [0, 1], [interpolateColor(warm.value, [0, 1], [color.primary, color.notice]), color.softDeep]),
      borderColor: interpolateColor(off.value, [0, 1], [interpolateColor(warm.value, [0, 1], [color.primaryShadow, color.notice]), color.line]),
      transform: [{ translateY: down.value * DEPTH }, { scale: reduce ? 1 : 1 - 0.04 * down.value - 0.1 * k }],
    };
  });
  const shadowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(off.value, [0, 1], [interpolateColor(warm.value, [0, 1], [color.primaryShadow, color.notice]), color.line]),
  }));
  const ringStyle = useAnimatedStyle(() => {
    const lv = level.value;
    const r = rec.value;
    const k = Math.min(1, drag.value);
    if (reduce) return { opacity: r * (0.35 + 0.65 * lv), transform: [{ scale: 1.22 }] };
    return {
      opacity: r * (0.55 + 0.45 * lv) * (1 - 0.5 * k),
      transform: [{ scale: 1 + r * (0.12 + 0.05 * breathe.value + 0.42 * lv) * (1 - 0.6 * k) }],
    };
  });
  const outerStyle = useAnimatedStyle(() => {
    const lv = level.value;
    const r = rec.value;
    if (reduce) return { opacity: 0 };
    return { opacity: r * 0.5 * lv, transform: [{ scale: 1.1 + r * (0.18 + 0.6 * lv) }] };
  });
  const hintStyle = useAnimatedStyle(() => {
    const k = Math.min(1, drag.value);
    // appears as you start to slide, full by halfway to the line
    const shown = Math.min(1, Math.max(0, (drag.value - 0.06) / 0.44));
    return {
      opacity: rec.value * (reduce ? (drag.value > 0.06 ? 1 : 0) : shown),
      backgroundColor: interpolateColor(warm.value, [0, 1], [color.soft, color.noticeTint]),
      transform: reduce ? [] : [{ translateY: (1 - rec.value) * 10 - k * 14 }, { scale: 0.92 + 0.12 * k }],
    };
  });

  // web keyboard: hold Space or Enter to talk, let go to send
  const keys =
    Platform.OS === 'web'
      ? {
          onKeyDown: (e: { key: string; repeat?: boolean; preventDefault(): void }) => {
            if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat) return;
            e.preventDefault();
            if (!can) return;
            down.value = reduce ? 1 : withSpring(1, spring.snappy);
            onDown();
          },
          onKeyUp: (e: { key: string; preventDefault(): void }) => {
            if (e.key !== ' ' && e.key !== 'Enter') return;
            e.preventDefault();
            down.value = reduce ? 0 : withSpring(0, spring.release);
            onUp(false);
          },
        }
      : null;

  const label = state === 'recording' ? (sr ? 'Stop and send' : 'Hold to talk. Release to send') : 'Hold to talk';
  const mic = (
    <Animated.View
      ref={micRef as RefObject<View>}
      collapsable={false}
      accessible
      focusable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sr ? 'Double-tap to start talking, and again to send.' : 'Slide up to cancel.'}
      accessibilityState={{ disabled: !can && state !== 'recording', busy: state === 'transcribing' || state === 'thinking' }}
      aria-disabled={!can && state !== 'recording'}
      aria-busy={state === 'transcribing' || state === 'thinking'}
      style={[styles.mic, WEB_NO_CALLOUT]}
      {...(keys as object)}
    >
      <Animated.View pointerEvents="none" style={[styles.micShadow, shadowStyle]} />
      <Animated.View pointerEvents="none" style={[styles.micFace, faceStyle]}>
        <MicrophoneIcon size={34} weight="fill" color={can || state === 'recording' ? color.white : color.faint} />
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={styles.wrap}>
      {state === 'recording' ? (
        // only while recording, and never touchable: it floats over the end of the thread
        <View pointerEvents="none" style={styles.hintRow}>
          <Animated.View style={[styles.hint, hintStyle]}>
            <XIcon size={14} weight="bold" color={armedJS ? color.notice : color.primary} />
            <Text variant="captionStrong" color={armedJS ? color.notice : color.primaryShadow}>
              {armedJS ? 'Release to cancel' : 'Slide up to cancel'}
            </Text>
          </Animated.View>
        </View>
      ) : null}
      <Status state={state} name={name} armed={armedJS} since={since} notice={notice?.text} />
      {notice?.error?.signIn ? <SaveProgressLink error={notice.error} style={styles.center} /> : null}
      <View style={styles.row}>
        <IconButton icon={<KeyboardIcon size={24} weight="bold" color={color.muted} />} label="Type instead" onPress={onType} />
        <View style={styles.micSlot}>
          <Animated.View pointerEvents="none" style={[styles.ring, styles.outer, outerStyle]} />
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
          {sr ? (
            <Pressable onPress={() => (state === 'recording' ? release() : can && onDown())} accessible={false}>
              {mic}
            </Pressable>
          ) : (
            <GestureDetector gesture={pan}>{mic}</GestureDetector>
          )}
        </View>
        {notice?.retry ? (
          <IconButton icon={<ArrowCounterClockwiseIcon size={22} weight="bold" color={color.primary} />} label="Send that again" onPress={retry} />
        ) : (
          <View style={styles.side} />
        )}
      </View>
    </View>
  );
}

/** The one line above the mic. Each state ticks over (stacked, so the outgoing line never holds space). */
function Status({ state, name, armed, since, notice }: { state: VoiceTurn['state']; name: string; armed: boolean; since: number | null; notice?: string }) {
  const tick = useTickSwap();
  let key: string = state;
  let body;
  if (state === 'recording') {
    key = armed ? 'cancel' : 'rec';
    body = armed ? (
      <Text variant="label" color={color.notice}>
        Release to cancel
      </Text>
    ) : (
      <View style={styles.inline}>
        <RecDot />
        <Text variant="label" color={color.ink}>
          Listening…
        </Text>
        {since ? <Elapsed since={since} /> : null}
      </View>
    );
  } else if (state === 'transcribing') {
    body = (
      <View style={styles.inline}>
        <Shimmer width={72} />
        <Text variant="label" color={color.muted}>
          Getting your words
        </Text>
      </View>
    );
  } else if (state === 'thinking') {
    body = (
      <Text variant="label" color={color.muted}>
        {name} is thinking…
      </Text>
    );
  } else if (state === 'speaking') {
    body = (
      <Text variant="label" color={color.muted}>
        {name} is talking. Hold to cut in.
      </Text>
    );
  } else if (notice) {
    key = `n:${notice}`;
    body = (
      <Text variant="label" color={color.ink} align="center" numberOfLines={2}>
        {notice}
      </Text>
    );
  } else {
    body = (
      <Text variant="label" color={color.muted}>
        Hold to talk
      </Text>
    );
  }
  return (
    <View style={[styles.status, notice && state === 'idle' ? styles.statusTall : null]} accessibilityLiveRegion="polite">
      <Animated.View key={key} entering={tick.entering} exiting={tick.exiting} pointerEvents="none" style={styles.statusLine}>
        {body}
      </Animated.View>
    </View>
  );
}

/** m:ss since recording started. Re-renders once a second (only itself); warm and counting down near the cap. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      setNow(Date.now());
      t = setTimeout(next, 1000 - ((Date.now() - since) % 1000) + 5);
    };
    t = setTimeout(next, 1000 - ((Date.now() - since) % 1000) + 5);
    return () => clearTimeout(t);
  }, [since]);
  const ms = Math.max(0, now - since);
  const s = Math.floor(ms / 1000);
  const late = ms >= SOFT_CAP_MS;
  const left = Math.max(0, Math.ceil((MAX_RECORDING_MS - ms) / 1000));
  return (
    <Text variant="label" color={late ? color.notice : color.muted} style={styles.timer}>
      {`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${late ? ` · ${left}s left` : ''}`}
    </Text>
  );
}

/** A small cobalt dot that breathes while the mic is open (steady under reduced motion). */
function RecDot() {
  const reduce = useReduceMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!reduce) o.value = withRepeat(withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(o);
  }, [reduce, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** VoiceOver / TalkBack. Web can't tell (react-native-web always answers true), so the web keeps the hold, plus Space/Enter. */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let live = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => live && setOn(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}

/** Say each state once, for VoiceOver and TalkBack (no-op without a screen reader). */
function useAnnounce(state: VoiceTurn['state'], name: string, notice?: string) {
  useEffect(() => {
    const say = state === 'recording' ? 'Listening' : state === 'transcribing' ? 'Sending' : state === 'speaking' ? `${name} is talking` : null;
    if (say && typeof AccessibilityInfo.announceForAccessibility === 'function') AccessibilityInfo.announceForAccessibility(say);
  }, [state, name]);
  useEffect(() => {
    if (notice && typeof AccessibilityInfo.announceForAccessibility === 'function') AccessibilityInfo.announceForAccessibility(notice);
  }, [notice]);
}

// iOS Safari: a long press must not select text, open the callout or scroll the page
const WEB_NO_CALLOUT =
  Platform.OS === 'web' ? ({ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none', cursor: 'pointer' } as object) : null;

const styles = StyleSheet.create({
  wrap: { alignItems: 'stretch' },
  center: { alignSelf: 'center' },
  status: { height: 24, marginBottom: space[2] },
  statusTall: { height: 42 },
  statusLine: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  timer: { fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.primary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 44, height: 44 },
  micSlot: { width: MIC + 48, height: MIC + DEPTH + 8, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: MIC, height: MIC, borderRadius: MIC / 2, top: 4, backgroundColor: color.primaryTint, zIndex: 0 },
  outer: { backgroundColor: color.soft },
  hintRow: { position: 'absolute', left: 0, right: 0, top: -58, alignItems: 'center', zIndex: 2 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[3],
    height: 30,
    borderRadius: radius.pill,
  },
  mic: { width: MIC, height: MIC + DEPTH, zIndex: 1 },
  micShadow: { position: 'absolute', left: 0, right: 0, top: DEPTH, height: MIC, borderRadius: MIC / 2 },
  micFace: { width: MIC, height: MIC, borderRadius: MIC / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
