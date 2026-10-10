import type { DrillFeedback } from '@antelope/core';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { PopIn } from '@/components/celebrate/PopIn';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { movePhrase } from '@/components/practice-loop/moves';
import { PossibleResponse } from '@/components/practice-loop/Speech';
import { Callout, Chip, LightbulbIcon, SealCheckIcon, Text, border, color, haptic, layout, radius, space } from '@/design';
import { Burst, Enter, FADE_MS, spring, useReduceMotion, type BurstHandle } from '@/motion';

/*
 * Two tones, never a verdict.
 *
 * Did what the drill asked (warm):
 *   t 0     scrim fades in; the panel rises on a livelier spring (quicker, a touch more overshoot)
 *   t 280   chip punches in, its seal check rotating in from -120°. On the punch's
 *           peak frame: haptic.success, a small Burst from the chip, the antelope hops
 *   t 380+  observation, what worked, possible responses, try next rise on the stagger
 *
 * Worth another pass (encouraging):
 *   t 0     scrim fades in; the panel rises on `gentle`; the antelope leans in (listening)
 *   t 300   chip fades and settles 4pt into place; one light haptic.tick as it lands
 *   ~t 900  "Try next" gets one forward cue: the lightbulb lights up cobalt with a
 *           single soft halo, and the card's edge brightens once, so the eye goes to the next step
 *   t 1700  the antelope eases back to idle
 *
 * Exit (`open` → false): the panel drops on `settle`, the scrim fades, then `onExited`.
 * Reduced motion: no travel; the panel and scrim cross-fade, chips fade, the bulb is simply lit.
 */
const LIVELY = { damping: 22, stiffness: 300, mass: 0.9 } as const;
/** The panel's face continues below the screen edge so an overshooting rise never shows a gap. */
const UNDERLAY = 56;
const CHIP_AT = 280;
const CUE_AT = 900;
const CHIP_BURST = [color.gold, color.gold, color.goldShadow, color.gold, color.primaryTint];

/**
 * Coach feedback for a free-text drill, over a light scrim. The move is named
 * in plain language, then observation, strength, possible responses and one
 * thing to try next.
 *
 * `open` (default true): set false to play the exit; `onExited` fires once the
 * panel has dropped, which is when the caller should unmount it. Setting `open`
 * back to true mid-exit springs it back up.
 */
export function FeedbackPanel({ feedback, paused, actions, open = true, onExited }: { feedback: DrillFeedback; paused?: boolean; actions: ReactNode; open?: boolean; onExited?: () => void }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const mascot = useRef<MascotHandle>(null);
  const burst = useRef<BurstHandle>(null);
  const hit = feedback.hitTarget;
  const y = useSharedValue(reduce ? 0 : height);
  const o = useSharedValue(0);
  const cue = useSharedValue(0);
  const [lean, setLean] = useState(!hit);
  const exited = useRef(onExited);
  exited.current = onExited;

  const fireExited = useCallback(() => exited.current?.(), []);

  useEffect(() => {
    if (open) {
      o.value = withTiming(1, { duration: reduce ? FADE_MS : 240 });
      if (!reduce) y.value = withSpring(0, hit ? LIVELY : spring.gentle);
      else y.value = 0;
      return;
    }
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(fireExited);
    };
    if (reduce) {
      o.value = withTiming(0, { duration: FADE_MS }, done);
    } else {
      o.value = withTiming(0, { duration: 220 });
      y.value = withSpring(height, { ...spring.settle, overshootClamping: true, energyThreshold: 1e-3 }, done);
    }
  }, [open, reduce, hit, height, y, o, fireExited]);

  // the miss: lean in for a beat, and one forward cue on "Try next"
  useEffect(() => {
    if (hit) return;
    cue.value = reduce ? withDelay(CUE_AT * 0.5, withTiming(1, { duration: FADE_MS })) : withDelay(CUE_AT, withTiming(1, { duration: 760, easing: Easing.out(Easing.quad) }));
    const t = setTimeout(() => setLean(false), 1700);
    return () => clearTimeout(t);
  }, [hit, reduce, cue]);

  const onChipPeak = useCallback(() => {
    if (hit) {
      haptic.success();
      burst.current?.fire();
      mascot.current?.hop();
    } else {
      haptic.tick();
    }
  }, [hit]);

  const panel = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: reduce ? o.value : 1,
  }));
  const scrim = useAnimatedStyle(() => ({ opacity: o.value }));

  const phrase = movePhrase(feedback.move);
  const headline = hit ? `That’s ${phrase}.` : `That landed as ${phrase}.`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'box-none' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]} pointerEvents="none" />
      <Animated.View
        style={[
          styles.panel,
          {
            maxHeight: height * 0.8 + UNDERLAY,
            bottom: -UNDERLAY,
            paddingBottom: Math.max(insets.bottom, space[3]) + space[2] + UNDERLAY,
          },
          panel,
        ]}
        accessibilityViewIsModal
        accessibilityLabel="Coach feedback"
      >
        <View style={styles.handle} />
        {/* the verdict stays put above the scroll, and its burst has room to fly */}
        <View style={[styles.head, styles.column]}>
          <Mascot ref={mascot} pose="head" mood={lean ? 'listening' : 'idle'} size={64} paused={paused} accessibilityLabel="The antelope coach" />
          <View style={styles.headCopy}>
            <View style={styles.chipRow}>
              <PopIn tone={hit ? 'lively' : 'calm'} delay={hit ? CHIP_AT : CHIP_AT + 20} onPeak={onChipPeak}>
                <Chip label={hit ? 'Did what the drill asked' : 'Worth another pass'} tone={hit ? 'gold' : 'soft'} icon={hit ? <SealIn delay={CHIP_AT} /> : undefined} />
              </PopIn>
              {hit ? (
                <View style={styles.chipBurst} pointerEvents="none">
                  <Burst ref={burst} colors={CHIP_BURST} count={12} power={0.6} scale={0.9} duration={600} spread={70} />
                </View>
              ) : null}
            </View>
            <Text variant="heading" accessibilityRole="header" style={styles.headline}>
              {headline}
            </Text>
          </View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, styles.column]} showsVerticalScrollIndicator={false}>
          <Enter index={1} delay={200}>
            <Text variant="body">{feedback.observation}</Text>
          </Enter>

          {feedback.strength ? (
            <Enter index={2} delay={200} style={styles.strength}>
              <SealCheckIcon size={20} weight="fill" color={color.gold} />
              <View style={styles.flex}>
                <Text variant="label">What worked</Text>
                <Text variant="body" color={color.ink}>
                  {feedback.strength}
                </Text>
              </View>
            </Enter>
          ) : null}

          {feedback.possibleResponses.map((r, i) => (
            <Enter key={i} index={3 + i} delay={200}>
              <PossibleResponse text={r} index={i} />
            </Enter>
          ))}

          <Enter index={3 + feedback.possibleResponses.length} delay={200}>
            <TryNext text={feedback.tryNext} cue={hit ? undefined : cue} />
          </Enter>
        </ScrollView>
        <View style={styles.actions}>{actions}</View>
      </Animated.View>
    </View>
  );
}

/** The chip's seal check: rotates and scales in with the chip's punch. */
function SealIn({ delay }: { delay: number }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    v.value = withDelay(delay + 40, withSpring(1, spring.bouncy));
  }, [reduce, delay, v]);
  const a = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(1 - v.value) * -120}deg` }, { scale: 0.3 + 0.7 * v.value }],
  }));
  return (
    <Animated.View style={a}>
      <SealCheckIcon size={14} weight="fill" color={color.goldInk} />
    </Animated.View>
  );
}

/**
 * "Try next". With `cue` (0 → 1, played once), the bulb lights cobalt with
 * one soft halo and the card's edge brightens and returns: a nudge, not an alarm.
 */
function TryNext({ text, cue }: { text: string; cue?: SharedValue<number> }) {
  const reduce = useReduceMotion();
  const none = useSharedValue(0);
  const c = cue ?? none;
  const lit = useAnimatedStyle(() => ({ opacity: Math.min(1, c.value * 3) }));
  const bulb = useAnimatedStyle(() => {
    const v = c.value;
    // one bump: up to 1.14 at a quarter of the way, back to 1
    const bump = reduce ? 0 : Math.sin(Math.min(1, v / 0.5) * Math.PI) * 0.14;
    return { transform: [{ scale: 1 + bump }] };
  });
  const halo = useAnimatedStyle(() => {
    const v = c.value;
    return {
      opacity: reduce || v <= 0 || v >= 1 ? 0 : 0.45 * (1 - v),
      transform: [{ scale: 1 + 0.9 * v }],
    };
  });
  const edge = useAnimatedStyle(() => {
    const v = c.value;
    return { opacity: reduce ? 0 : Math.sin(Math.min(1, v) * Math.PI) * 0.9 };
  });
  return (
    <Callout
      glyph={
        <View style={styles.tryIconBox}>
          {cue ? <Animated.View pointerEvents="none" style={[styles.tryHalo, halo]} /> : null}
          <Animated.View style={[styles.tryIcon, bulb]}>
            <LightbulbIcon size={18} weight="fill" color={color.primary} />
            {cue ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tryIconLit, lit]}>
                <LightbulbIcon size={18} weight="fill" color={color.white} />
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      }
      overline="Try next"
      overlay={cue ? <Animated.View pointerEvents="none" style={[styles.tryEdge, edge]} /> : null}
    >
      <Text variant="body">{text}</Text>
    </Callout>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(10, 40, 78, 0.16)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: color.white,
    borderTopLeftRadius: radius.illustration,
    borderTopRightRadius: radius.illustration,
    borderWidth: border,
    borderBottomWidth: 0,
    borderColor: color.line,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.line,
    marginTop: space[3],
  },
  scroll: { flexGrow: 0 },
  column: {
    paddingHorizontal: layout.gutter,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  content: { paddingTop: space[3], paddingBottom: space[4], gap: space[4] },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingTop: space[4],
    zIndex: 1,
  },
  headCopy: { flex: 1, gap: space[2] },
  chipRow: { alignSelf: 'flex-start' },
  chipBurst: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  headline: {},
  strength: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  flex: { flex: 1 },
  // the cue's edge traces the callout's own box
  tryEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.md,
    borderWidth: border,
    borderColor: color.primary,
  },
  tryIconBox: { width: 32, height: 32 },
  tryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryIconLit: {
    borderRadius: 16,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryHalo: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: color.primary,
  },
  actions: {
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
    gap: space[2],
    borderTopWidth: border,
    borderTopColor: color.rule,
    width: '100%',
    maxWidth: layout.maxWidth + 40,
    alignSelf: 'center',
  },
});
