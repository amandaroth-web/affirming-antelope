import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CheckIcon, LockSimpleIcon, PressableSurface, Text, color } from '@/design';
import { spring, useReduceMotion } from '@/motion';
import type { WeekStatus } from '@/state/store';
import { NODE } from './geometry';

export interface WeekNodeHandle {
  shake: () => void;
}

/**
 * A week on the trail. Complete: ochre with a check. Current: cobalt with the
 * week number and a ring that keeps breathing outward. Locked: muted with a lock.
 */
export const WeekNode = forwardRef<WeekNodeHandle, { week: number; title: string; status: WeekStatus; onPress: () => void; paused?: boolean }>(
  function WeekNode({ week, title, status, onPress, paused }, ref) {
    const reduce = useReduceMotion();
    const shakeX = useSharedValue(0);
    const pulse = useSharedValue(0);

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
    }));

    useEffect(() => {
      if (status !== 'current' || reduce || paused) {
        cancelAnimation(pulse);
        pulse.value = 0;
        return;
      }
      pulse.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), -1, false);
      return () => cancelAnimation(pulse);
    }, [status, reduce, paused, pulse]);

    const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
    const ring = useAnimatedStyle(() => ({
      opacity: 0.55 * (1 - pulse.value),
      transform: [{ scale: 1 + pulse.value * 0.55 }],
    }));

    const tone = status === 'complete' ? 'gold' : status === 'current' ? 'primary' : 'locked';
    const label =
      status === 'complete'
        ? `Week ${week}, ${title}, complete`
        : status === 'current'
          ? `Week ${week}, ${title}, in progress`
          : `Week ${week}, ${title}, locked`;

    return (
      <Animated.View style={shakeStyle}>
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
          {status === 'complete' ? (
            <CheckIcon size={32} weight="bold" color={color.white} />
          ) : status === 'current' ? (
            <Text variant="title" color={color.white} maxScale={1} style={styles.num}>
              {week}
            </Text>
          ) : (
            <LockSimpleIcon size={26} weight="bold" color={color.faint} />
          )}
        </PressableSurface>
      </Animated.View>
    );
  },
);

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
});
