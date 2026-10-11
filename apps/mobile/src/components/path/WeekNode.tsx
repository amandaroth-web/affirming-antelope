import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CheckIcon, PressableSurface, Text, color } from '@/design';
import { Burst, FADE_MS, spring, useReduceMotion, type BurstHandle } from '@/motion';
import type { WeekStatus } from '@/state/store';
import { NODE } from './geometry';

export interface WeekNodeHandle {
  shake: () => void;
  /** Dip, then spring back past full size: a status landing (check, unlock) or an acknowledgement. */
  pop: () => void;
  /** The lock opens: shackle lifts and swings on one leg, the body drops away, a small burst. */
  breakLock: () => void;
}

const RING = { complete: color.gold, current: color.primary, locked: color.faint } as const;
const HALO = { complete: 'rgba(232,166,56,0.26)', current: 'rgba(79,107,237,0.2)', locked: 'rgba(163,170,194,0.2)' } as const;
const UNLOCK_BURST = [color.primary, color.primary, color.primaryTint, color.gold, color.primary, color.primaryTint];

/**
 * A week on the trail. Complete: ochre with a check. Current: cobalt with the
 * week number and a ring that keeps breathing outward. Locked: muted with a lock.
 * `anchored` (its sheet is open): the node swells slightly and a halo in its
 * tone breathes in; it breathes out when the sheet closes.
 */
export const WeekNode = forwardRef<
  WeekNodeHandle,
  { week: number; /** Weeks in the course, for the spoken label ("Week 3 of 8"). */ total?: number; title: string; status: WeekStatus; onPress: () => void; paused?: boolean; anchored?: boolean }
>(function WeekNode({ week, total, title, status, onPress, paused, anchored }, ref) {
  const reduce = useReduceMotion();
  const shakeX = useSharedValue(0);
  const pulse = useSharedValue(0);
  const popS = useSharedValue(1);
  const fade = useSharedValue(1); // reduced-motion stand-in for a pop
  const glyph = useSharedValue(1);
  const anchor = useSharedValue(0);
  const receive = useSharedValue(1);
  const wasAnchored = useRef(false);
  // lock pieces
  const lockOn = useSharedValue(status === 'locked' ? 1 : 0);
  const shackle = useSharedValue(0); // 0 closed .. 1 swung open
  const shackleFade = useSharedValue(1);
  const bodyDrop = useSharedValue(0); // 0 in place .. 1 fallen away
  const breaking = useRef(false);
  const burst = useRef<BurstHandle>(null);

  useImperativeHandle(ref, () => ({
    shake: () => {
      if (reduce) return;
      shakeX.value = withSequence(
        withTiming(-7, { duration: 45 }),
        withTiming(7, { duration: 70 }),
        withTiming(-5, { duration: 65 }),
        withTiming(4, { duration: 60 }),
        withSpring(0, spring.release),
      );
    },
    pop: () => {
      if (reduce) {
        fade.value = 0.35;
        fade.value = withTiming(1, { duration: FADE_MS });
        return;
      }
      // the face swap (a re-render) lands inside the dip, so it reads as one gesture
      popS.value = withSequence(withTiming(0.86, { duration: 80, easing: Easing.out(Easing.quad) }), withSpring(1, spring.bouncy));
      glyph.value = withSequence(withTiming(0.5, { duration: 80 }), withSpring(1, spring.bouncy));
    },
    breakLock: () => {
      if (reduce) {
        lockOn.value = withTiming(0, { duration: FADE_MS });
        return;
      }
      breaking.current = true;
      lockOn.value = 1;
      shackle.value = 0;
      shackleFade.value = 1;
      bodyDrop.value = 0;
      shackle.value = withSpring(1, spring.bouncy);
      shackleFade.value = withDelay(90, withTiming(0, { duration: 150 }));
      bodyDrop.value = withDelay(20, withTiming(1, { duration: 260, easing: Easing.in(Easing.quad) }));
      burst.current?.fire();
    },
  }));

  // lock visibility follows status, except while it is breaking open
  useEffect(() => {
    if (status === 'locked') {
      breaking.current = false;
      cancelAnimation(shackle);
      cancelAnimation(bodyDrop);
      cancelAnimation(shackleFade);
      shackle.value = 0;
      bodyDrop.value = 0;
      shackleFade.value = 1;
      lockOn.value = 1;
    } else if (breaking.current) {
      breaking.current = false; // pieces finish falling on their own
    } else {
      lockOn.value = 0;
    }
  }, [status, shackle, bodyDrop, shackleFade, lockOn]);

  useEffect(() => {
    if (reduce) {
      anchor.value = withTiming(anchored ? 1 : 0, { duration: FADE_MS });
      return;
    }
    anchor.value = anchored ? withSpring(1, spring.gentle) : withSpring(0, spring.settle);
    // the sheet has come home: one thin ring ripples out of the node as it arrives (~node size, no disc)
    if (!anchored && wasAnchored.current) {
      receive.value = 0;
      receive.value = withDelay(120, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));
    }
    wasAnchored.current = !!anchored;
  }, [anchored, reduce, anchor, receive]);

  useEffect(() => {
    if (status !== 'current' || reduce || paused) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [status, reduce, paused, pulse]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: shakeX.value }, { scale: popS.value * (1 + 0.08 * (reduce ? 0 : anchor.value)) }],
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.55 }],
  }));
  const receiveStyle = useAnimatedStyle(() => ({
    opacity: receive.value >= 1 ? 0 : 0.7 * (1 - receive.value),
    transform: [{ scale: 1 + 0.42 * receive.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: anchor.value,
    transform: [{ scale: reduce ? 1 : 0.82 + 0.18 * anchor.value }],
  }));
  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: glyph.value }] }));
  const shackleStyle = useAnimatedStyle(() => ({
    opacity: lockOn.value * shackleFade.value,
    transform: [{ translateY: -7 * shackle.value }, { rotate: `${-34 * shackle.value}deg` }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: lockOn.value * (1 - Math.min(1, Math.max(0, (bodyDrop.value - 0.15) / 0.5))),
    transform: [{ translateY: 22 * bodyDrop.value }, { rotate: `${16 * bodyDrop.value}deg` }],
  }));

  const tone = status === 'complete' ? 'gold' : status === 'current' ? 'primary' : 'locked';
  const of = total ? ` of ${total}` : '';
  const label = `Week ${week}${of}, ${title}, ${status === 'complete' ? 'complete' : status === 'current' ? 'in progress' : 'locked'}`;

  return (
    <Animated.View style={wrapStyle}>
      <Animated.View pointerEvents="none" style={[styles.anchorHalo, { backgroundColor: HALO[status] }, haloStyle]} />
      <Animated.View pointerEvents="none" style={[styles.receive, { borderColor: RING[status] }, receiveStyle]} />
      {status === 'current' && (
        <>
          <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
          <View pointerEvents="none" style={styles.halo} />
        </>
      )}
      <PressableSurface
        tone={tone}
        depth={6}
        radius={NODE / 2}
        onPress={onPress}
        haptic={status === 'locked' ? false : 'press'}
        accessibilityLabel={label}
        accessibilityHint={status === 'locked' ? 'Shows what unlocks this week' : 'Opens the week'}
        style={styles.node}
        contentStyle={styles.face}
      >
        {status !== 'locked' && (
          <Animated.View style={glyphStyle}>
            {status === 'complete' ? (
              <CheckIcon size={32} weight="bold" color={color.navy} />
            ) : (
              <Text variant="title" color={color.white} maxScale={1} style={styles.num}>
                {week}
              </Text>
            )}
          </Animated.View>
        )}
        {/* the lock is drawn in two pieces so it can break open */}
        <View pointerEvents="none" style={styles.lockBox}>
          <View style={styles.lock}>
            {/* once the face turns cobalt, the falling pieces read as a pale shell */}
            <Animated.View style={[styles.shackle, status !== 'locked' && styles.shellLine, shackleStyle]} />
            <Animated.View style={[styles.body, status !== 'locked' && styles.shellFill, bodyStyle]}>
              <View style={[styles.keyhole, status !== 'locked' && styles.shellHole]} />
            </Animated.View>
          </View>
        </View>
      </PressableSurface>
      <Burst ref={burst} count={12} power={0.5} spread={180} scale={0.8} duration={560} colors={UNLOCK_BURST} style={styles.burst} />
    </Animated.View>
  );
});

const LOCK_W = 22;
const styles = StyleSheet.create({
  node: { width: NODE, height: NODE + 6 },
  face: { alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 30, lineHeight: 34, marginTop: -2 },
  ring: {
    position: 'absolute',
    left: -2,
    top: -2,
    width: NODE + 4,
    height: NODE + 4,
    borderRadius: (NODE + 4) / 2,
    borderWidth: 4,
    borderColor: color.primary,
  },
  halo: {
    position: 'absolute',
    left: -9,
    top: -9,
    width: NODE + 18,
    height: NODE + 18 + 6,
    borderRadius: (NODE + 18) / 2,
    backgroundColor: 'rgba(79,107,237,0.12)',
  },
  receive: { position: 'absolute', left: -1, top: 2, width: NODE + 2, height: NODE + 2, borderRadius: (NODE + 2) / 2, borderWidth: 3 },
  anchorHalo: {
    position: 'absolute',
    left: -16,
    top: -16 + 3,
    width: NODE + 32,
    height: NODE + 32,
    borderRadius: (NODE + 32) / 2,
  },
  lockBox: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  lock: { width: LOCK_W, height: 26, marginTop: 2 },
  shackle: {
    position: 'absolute',
    left: 4,
    top: 0,
    width: LOCK_W - 8,
    height: 14,
    borderWidth: 3.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderColor: color.faint,
    // swings open on its right leg
    transformOrigin: 'right bottom',
  },
  body: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: LOCK_W,
    height: 15,
    borderRadius: 4.5,
    backgroundColor: color.faint,
    alignItems: 'center',
    paddingTop: 4,
  },
  keyhole: { width: 3.5, height: 6, borderRadius: 2, backgroundColor: color.soft },
  shellLine: { borderColor: 'rgba(255,255,255,0.85)' },
  shellFill: { backgroundColor: 'rgba(255,255,255,0.85)' },
  shellHole: { backgroundColor: color.primary },
  burst: { top: NODE / 2 },
});
