import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from './springs';
import { useReduceMotion } from './useMotionPrefs';

/**
 * Press feedback for things that are not raised surfaces (icons, list rows):
 * scale down on press-in, spring back with a hint of overshoot.
 */
export function usePressScale(scaleTo = 0.96) {
  const reduce = useReduceMotion();
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }],
    opacity: reduce ? 1 - pressed.value * 0.25 : 1,
  }));
  return {
    style,
    onPressIn: () => {
      pressed.value = withSpring(1, spring.snappy);
    },
    onPressOut: () => {
      pressed.value = withSpring(0, spring.release);
    },
  };
}
