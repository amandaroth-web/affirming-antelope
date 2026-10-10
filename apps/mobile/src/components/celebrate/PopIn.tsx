import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { FADE_MS, spring, useReduceMotion } from '@/motion';

/**
 * A badge or chip arriving with a feeling.
 *
 * - `lively` (achievement): punches up to 1.12 in 110ms, then settles on
 *   `bouncy`. `onPeak` fires on the frame the punch tops out, so a haptic or a
 *   Burst lands with the biggest frame, not before it.
 * - `calm` (keep going): fades and settles 4pt into place on `gentle`, no
 *   scale. `onPeak` fires as it becomes fully opaque.
 *
 * Plays once when `play` first turns true. Reduced motion: a cross-fade, and
 * `onPeak` still fires when it completes.
 */
export function PopIn({
  play = true,
  delay = 0,
  tone = 'lively',
  onPeak,
  children,
  style,
}: {
  play?: boolean;
  delay?: number;
  tone?: 'lively' | 'calm';
  onPeak?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const o = useSharedValue(0);
  const s = useSharedValue(tone === 'lively' ? 0.55 : 1);
  const y = useSharedValue(tone === 'calm' ? 4 : 0);
  const ran = useRef(false);
  const peak = useRef(onPeak);
  peak.current = onPeak;

  useEffect(() => {
    if (!play || ran.current) return;
    ran.current = true;
    const fire = () => peak.current?.();
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(fire);
    };
    if (reduce) {
      s.value = 1;
      y.value = 0;
      o.value = withDelay(delay, withTiming(1, { duration: FADE_MS }, done));
    } else if (tone === 'lively') {
      o.value = withDelay(delay, withTiming(1, { duration: 90 }));
      s.value = withDelay(delay, withSequence(withTiming(1.12, { duration: 110, easing: Easing.out(Easing.quad) }, done), withSpring(1, spring.bouncy)));
    } else {
      o.value = withDelay(delay, withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }, done));
      y.value = withDelay(delay, withSpring(0, spring.gentle));
    }
  }, [play, reduce, delay, tone, o, s, y]);

  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { scale: s.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}
