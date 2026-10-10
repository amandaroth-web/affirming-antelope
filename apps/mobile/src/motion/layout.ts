import {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';
import { FADE_MS } from './constants';
import { useReduceMotion } from './useMotionPrefs';

/**
 * Layout animation presets (Reanimated `layout` / `entering` / `exiting`).
 *
 * Reanimated's builders only follow the OS reduce-motion setting, not
 * Me > Reduce motion, so always go through these hooks: under reduced motion
 * layout moves snap (no travel) and entrances/exits become short cross-fades.
 * Every builder here is a predefined one so it also runs on web.
 */

/** Siblings sliding to make room. Same feel as spring.gentle, a touch quicker. */
const LIST = () => LinearTransition.springify().damping(22).stiffness(260).mass(0.9).reduceMotion(ReduceMotion.Never);

export function useListLayout() {
  const reduce = useReduceMotion();
  return reduce ? undefined : LIST();
}

/** Fade in/out pair that stays a fade even under reduced motion. */
export function useFades(inMs = 180, outMs = 120) {
  return {
    entering: FadeIn.duration(inMs).reduceMotion(ReduceMotion.Never),
    exiting: FadeOut.duration(outMs).reduceMotion(ReduceMotion.Never),
  };
}

/** A value ticking over: new content rises in from below, old content lifts away. */
export function useTickSwap() {
  const reduce = useReduceMotion();
  if (reduce) return { entering: FadeIn.duration(FADE_MS).reduceMotion(ReduceMotion.Never), exiting: FadeOut.duration(100).reduceMotion(ReduceMotion.Never) };
  return {
    entering: FadeInDown.springify().damping(18).stiffness(320).mass(0.7).withInitialValues({ transform: [{ translateY: 8 }] }).reduceMotion(ReduceMotion.Never),
    exiting: FadeOutUp.duration(140).withInitialValues({ transform: [{ translateY: 0 }] }).reduceMotion(ReduceMotion.Never),
  };
}

/** Moving forward through a sequence ("One more", next card): out to the left, in from the right. */
export function useForwardSwap() {
  const reduce = useReduceMotion();
  if (reduce) return { entering: FadeIn.duration(FADE_MS).reduceMotion(ReduceMotion.Never), exiting: FadeOut.duration(120).reduceMotion(ReduceMotion.Never) };
  return {
    entering: FadeInRight.springify().damping(20).stiffness(220).mass(0.9).delay(70).reduceMotion(ReduceMotion.Never),
    exiting: FadeOutLeft.duration(180).reduceMotion(ReduceMotion.Never),
  };
}
