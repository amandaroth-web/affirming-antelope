import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { color } from '@/design';
import { useReduceMotion } from '@/motion';
import type { TrailLayout } from './geometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The trail draws itself in as you scroll: the drawn length follows the bottom
 * of the viewport (strokeDashoffset). The walked part is ochre; ahead is cobalt tint.
 */
export const Trail = memo(function Trail({
  layout,
  walkedLen,
  scrollY,
  viewportH,
}: {
  layout: TrailLayout;
  walkedLen: number;
  scrollY: SharedValue<number>;
  viewportH: number;
}) {
  const reduce = useReduceMotion();
  const intro = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) intro.value = withDelay(150, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [reduce, intro]);

  const L = layout.length;
  const { ys, lens } = layout;
  const drawn = useDerivedValue(() => {
    const edge = scrollY.value + viewportH * 0.92;
    return interpolate(edge, ys, lens, 'clamp') * intro.value;
  });

  const ahead = useAnimatedProps(() => ({ strokeDashoffset: L - drawn.value }));
  const walked = useAnimatedProps(() => ({ strokeDashoffset: L - Math.min(drawn.value, walkedLen) }));

  return (
    <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* bed: a pale path worn into the landscape */}
      <Path d={layout.d} stroke={color.line} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={layout.d} stroke={color.white} strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <AnimatedPath
        d={layout.d}
        stroke={color.primaryTint}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${L} ${L}`}
        animatedProps={ahead}
      />
      <AnimatedPath
        d={layout.d}
        stroke={color.gold}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${L} ${L}`}
        animatedProps={walked}
      />
    </Svg>
  );
});
