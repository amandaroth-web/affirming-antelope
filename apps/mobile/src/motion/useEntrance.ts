import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ENTER_OFFSET, FADE_MS, STAGGER } from './constants';
import { spring } from './springs';
import { useReduceMotion } from './useMotionPrefs';

export interface EntranceOptions {
  /** Position in a staggered list. */
  index?: number;
  /** Extra delay before this element's slot, ms. */
  delay?: number;
  /** 'up' rises into place; 'scale' pops from 0.92; 'fade' only fades. */
  from?: 'up' | 'scale' | 'fade';
  /** Re-run when this changes (e.g. on screen focus). */
  trigger?: unknown;
}

/**
 * Staggered entrance on mount. Spring-driven on the UI thread; under reduced
 * motion it becomes a short cross-fade with no travel.
 */
export function useEntrance({ index = 0, delay = 0, from = 'up', trigger }: EntranceOptions = {}) {
  const reduce = useReduceMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = 0;
    const wait = delay + index * STAGGER;
    p.value = reduce
      ? withDelay(wait * 0.5, withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.quad) }))
      : withDelay(wait, withSpring(1, spring.gentle));
  }, [reduce, delay, index, trigger, p]);

  return useAnimatedStyle(() => {
    const v = p.value;
    const opacity = Math.min(1, v * 1.4);
    if (reduce || from === 'fade') return { opacity };
    if (from === 'scale') return { opacity, transform: [{ scale: 0.92 + 0.08 * v }] };
    return { opacity, transform: [{ translateY: (1 - v) * ENTER_OFFSET }] };
  });
}
