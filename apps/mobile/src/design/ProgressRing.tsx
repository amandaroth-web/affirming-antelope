import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
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
}: ProgressRingProps) {
  const reduce = useReduceMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  const target = Math.max(0, Math.min(1, value));

  useEffect(() => {
    const done = (finished?: boolean) => {
      'worklet';
      if (finished && target >= 1 && onFilled) scheduleOnRN(onFilled);
    };
    p.value = reduce
      ? withTiming(target, { duration: 0 }, done)
      : withDelay(delay, withSpring(target, spring.settle, done));
  }, [target, reduce, delay, onFilled, p]);

  const props = useAnimatedProps(() => ({
    // a hair short of 0 so a 0% ring still shows its round cap as a dot
    strokeDashoffset: c * (1 - Math.max(0.0001, Math.min(1, p.value))),
  }));

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
    >
      <Svg width={size} height={size} style={styles.rotate}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          fill="none"
          animatedProps={props}
        />
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
