import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/motion/usePress';
import { layout } from './tokens';

export interface IconButtonProps {
  icon: ReactNode;
  onPress: () => void;
  /** Spoken label; icon-only controls always need one. */
  label: string;
  hitSlop?: number;
  /** How far the glyph shrinks while pressed. */
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
}

/** Flat icon control with a 44pt hit target (`layout.minHit`) that squeezes on press. */
export function IconButton({ icon, onPress, label, hitSlop = 6, pressScale = 0.88, style }: IconButtonProps) {
  const press = usePressScale(pressScale);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlop}
      style={[styles.hit, style]}
    >
      <Animated.View style={press.style}>{icon}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: layout.minHit, height: layout.minHit, alignItems: 'center', justifyContent: 'center' },
});
