import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from '@/motion/springs';
import { haptic } from './haptics';
import { color } from './tokens';

const W = 52;
const H = 32;
const K = 24;

/** Brand switch: the thumb springs across with a squash on arrival. */
export function Switch({ value, onChange, accessibilityLabel }: { value: boolean; onChange: (v: boolean) => void; accessibilityLabel: string }) {
  const v = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    v.value = withSpring(value ? 1 : 0, spring.release);
  }, [value, v]);
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [color.line, color.primary]),
    borderColor: interpolateColor(v.value, [0, 1], [color.shadow, color.primaryShadow]),
  }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: v.value * (W - K - 8) }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={() => {
        haptic.tick();
        onChange(!value);
      }}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.thumb, thumb]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: H, borderRadius: H / 2, borderWidth: 2, padding: 2, justifyContent: 'center' },
  thumb: {
    width: K,
    height: K,
    borderRadius: K / 2,
    backgroundColor: color.white,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(10,40,78,0.12)',
  },
});
