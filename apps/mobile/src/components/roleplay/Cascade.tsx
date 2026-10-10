import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { FADE_MS, spring, useReduceMotion } from '@/motion';

const STEP = 80;

/**
 * A list row that arrives in turn when `play` flips: the line slides in from
 * the left on gentle while its icon pops on bouncy a beat later, so the eye
 * lands on the icon, then reads. `settled` shows it in place.
 */
export function Cascade({
  index,
  play,
  settled,
  icon,
  children,
  style,
}: {
  index: number;
  play: boolean;
  settled?: boolean;
  icon: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const row = useSharedValue(settled ? 1 : 0);
  const pop = useSharedValue(settled ? 1 : 0);
  useEffect(() => {
    if (!play || settled) return;
    const wait = index * STEP;
    if (reduce) {
      row.value = withTiming(1, { duration: FADE_MS });
      pop.value = 1;
      return;
    }
    row.value = withDelay(wait, withSpring(1, spring.gentle));
    pop.value = withDelay(wait + 90, withSpring(1, spring.bouncy));
  }, [play, settled, reduce, index, row, pop]);
  const rowStyle = useAnimatedStyle(() =>
    reduce ? { opacity: row.value } : { opacity: Math.min(1, row.value * 1.4), transform: [{ translateX: (1 - row.value) * -14 }] },
  );
  const iconStyle = useAnimatedStyle(() => (reduce ? {} : { transform: [{ scale: pop.value }, { rotate: `${(1 - pop.value) * -30}deg` }] }));
  return (
    <Animated.View style={[style, rowStyle]}>
      <Animated.View style={iconStyle}>{icon}</Animated.View>
      <View style={{ flex: 1 }}>{children}</View>
    </Animated.View>
  );
}
