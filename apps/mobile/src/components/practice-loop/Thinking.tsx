import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Mascot } from '@/components/mascot';
import { Text, color, radius, space } from '@/design';
import { FADE_MS, useReduceMotion } from '@/motion';

/** A soft band of light that sweeps a track: "working on it", without a fake percentage. */
export function Shimmer({ width = 180, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = reduce
      ? withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1)
      : withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1);
    return () => cancelAnimation(x);
  }, [reduce, x]);
  const band = useAnimatedStyle(() =>
    reduce ? { opacity: 0.35 + 0.5 * x.value, left: 0, right: 0 } : { transform: [{ translateX: -width * 0.45 + x.value * width * 1.45 }] },
  );
  return (
    <View style={[styles.track, { width }, style]} accessibilityRole="progressbar" accessibilityLabel="Working on it">
      <Animated.View style={[styles.band, { width: width * 0.45 }, band]} />
    </View>
  );
}

/** Rotating coach lines, cross-faded. */
export function RotatingLine({ lines, every = 2200 }: { lines: string[]; every?: number }) {
  const [i, setI] = useState(0);
  const o = useSharedValue(1);
  useEffect(() => {
    if (lines.length < 2) return;
    const id = setInterval(() => {
      o.value = withSequence(withTiming(0, { duration: 160 }), withTiming(1, { duration: 220 }));
      setTimeout(() => setI((n) => (n + 1) % lines.length), 160);
    }, every);
    return () => clearInterval(id);
  }, [lines.length, every, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={style} accessibilityLiveRegion="polite">
      <Text variant="body" color={color.muted} align="center">
        {lines[i]}
      </Text>
    </Animated.View>
  );
}

/** The coach reading your work: listening antelope, shimmer, rotating lines. */
export function CoachThinking({ title, lines, size = 120, paused }: { title: string; lines: string[]; size?: number; paused?: boolean }) {
  const reduce = useReduceMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: reduce ? FADE_MS : 320 });
  }, [p, reduce]);
  const enter = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.thinking, enter]}>
      <Mascot pose="head" mood="listening" size={size} paused={paused} accessibilityLabel="The antelope coach, reading" />
      <Text variant="heading" align="center" style={styles.title}>
        {title}
      </Text>
      <Shimmer />
      <View style={styles.lines}>
        <RotatingLine lines={lines} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.pill, backgroundColor: color.soft, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: color.primaryTint },
  thinking: { alignItems: 'center', gap: space[4] },
  title: { marginTop: space[2] },
  lines: { minHeight: 44, paddingHorizontal: space[5] },
});
