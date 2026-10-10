import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
import { color } from './tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  tint?: string;
  track?: string;
  delay?: number;
  /** Called once when the ring lands on a full value (pair with haptic.success). */
  onFilled?: () => void;
  children?: ReactNode;
  accessibilityLabel?: string;
  /**
   * Choreographed use (e.g. completion): drive the fill from outside, 0..1, so
   * the caller can chain beats off the spring's own landing callback. When
   * set, `value`/`delay`/`onFilled` no longer animate anything; `value` is
   * still used for accessibility.
   */
  progress?: SharedValue<number>;
  /** 0..1 cross-fade of the arc from `tint` to `blendTint` (cobalt → ochre when a goal closes). */
  blend?: SharedValue<number>;
  blendTint?: string;
  /** 0..1 halo pulse: a ring scales out from the arc and fades. Drive 0 → 1 per pulse. */
  glow?: SharedValue<number>;
  glowTint?: string;
}

/** Springs from empty to its value on mount, and between values after. */
export function ProgressRing({
  value,
  size = 88,
  stroke = 10,
  tint = color.primary,
  track = color.soft,
  delay = 0,
  onFilled,
  children,
  accessibilityLabel,
  progress,
  blend,
  blendTint = color.gold,
  glow,
  glowTint,
}: ProgressRingProps) {
  const reduce = useReduceMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const own = useSharedValue(0);
  const noBlend = useSharedValue(0);
  const noGlow = useSharedValue(0);
  const p = progress ?? own;
  const b = blend ?? noBlend;
  const g = glow ?? noGlow;
  const driven = !!progress;
  const target = Math.max(0, Math.min(1, value));

  useEffect(() => {
    if (driven) return;
    const done = (finished?: boolean) => {
      'worklet';
      if (finished && target >= 1 && onFilled) scheduleOnRN(onFilled);
    };
    own.value = reduce ? withTiming(target, { duration: 0 }, done) : withDelay(delay, withSpring(target, spring.settle, done));
  }, [driven, target, reduce, delay, onFilled, own]);

  const arc = useAnimatedProps(() => ({
    // a hair short of 0 so a 0% ring still shows its round cap as a dot
    strokeDashoffset: c * (1 - Math.max(0.0001, Math.min(1, p.value))),
  }));
  const arcBlend = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - Math.max(0.0001, Math.min(1, p.value))),
    strokeOpacity: b.value,
  }));
  const halo = useAnimatedStyle(() => {
    const v = g.value;
    return { opacity: v <= 0 || v >= 1 ? 0 : 0.55 * (1 - v), transform: [{ scale: 1 + 0.42 * v }] };
  });

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
    >
      {glow ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: Math.max(3, stroke * 0.7), borderColor: glowTint ?? tint }, halo]} /> : null}
      <Svg width={size} height={size} style={styles.rotate}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={tint} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c} ${c}`} fill="none" animatedProps={arc} />
        {blend ? (
          <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={blendTint} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c} ${c}`} fill="none" animatedProps={arcBlend} />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rotate: { transform: [{ rotate: '-90deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
});
