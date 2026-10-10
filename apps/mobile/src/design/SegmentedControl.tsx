import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
import { haptic } from './haptics';
import { Text } from './Text';
import { border, color, radius } from './tokens';

export interface Segment<T extends string | number> {
  value: T;
  label: string;
  /** Second line, e.g. "drill" or "role-play". */
  hint?: string;
}

export interface SegmentedControlProps<T extends string | number> {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}

const PAD = 4;
const THUMB_DEPTH = 3;

/** A periwinkle track with a raised white thumb that slides on the snappy spring. */
export function SegmentedControl<T extends string | number>({ segments, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const index = Math.max(0, segments.findIndex((s) => s.value === value));
  const segW = w > 0 ? (w - PAD * 2) / segments.length : 0;
  const x = useSharedValue(0);
  const squash = useSharedValue(1);

  useEffect(() => {
    if (!segW) return;
    if (reduce) {
      x.value = index * segW;
      return;
    }
    x.value = withSpring(index * segW, spring.snappy);
    // a quick stretch while travelling reads as momentum
    squash.value = 1.06;
    squash.value = withSpring(1, spring.bouncy);
  }, [index, segW, reduce, x, squash]);

  const thumb = useAnimatedStyle(() => ({
    width: segW,
    transform: [{ translateX: x.value }, { scaleX: squash.value }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.track}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {segW > 0 && (
        <Animated.View pointerEvents="none" style={[styles.thumbWrap, thumb]}>
          <View style={styles.thumbShadow} />
          <View style={styles.thumb} />
        </Animated.View>
      )}
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={String(s.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={s.hint ? `${s.label}, ${s.hint}` : s.label}
            onPress={() => {
              if (!active) {
                haptic.tick();
                onChange(s.value);
              }
            }}
            style={styles.segment}
          >
            <Text variant="subheading" color={active ? color.primary : color.muted} maxScale={1.2}>
              {s.label}
            </Text>
            {s.hint ? (
              <Text variant="caption" color={active ? color.primaryShadow : color.muted} maxScale={1.2}>
                {s.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: color.soft,
    borderRadius: radius.surface,
    borderWidth: border,
    borderColor: color.line,
    padding: PAD - border / 2,
    paddingBottom: PAD + THUMB_DEPTH - border / 2,
  },
  thumbWrap: { position: 'absolute', top: PAD - border / 2, bottom: PAD - border / 2, left: PAD - border / 2 },
  thumbShadow: { position: 'absolute', left: 0, right: 0, bottom: 0, top: THUMB_DEPTH, borderRadius: radius.md, backgroundColor: color.shadow },
  thumb: {
    position: 'absolute', left: 0, right: 0, top: 0,
    bottom: THUMB_DEPTH,
    borderRadius: radius.md,
    backgroundColor: color.white,
    borderWidth: border,
    borderColor: color.line,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, paddingVertical: 6 },
});
