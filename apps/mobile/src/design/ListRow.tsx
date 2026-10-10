import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/motion/usePress';
import { border, color, space } from './tokens';

export interface ListRowProps {
  onPress: () => void;
  /** The last row in a card carries no rule. */
  last?: boolean;
  accessibilityLabel: string;
  /** The row's content (a lead, copy and trailing glyph). It lays out as a row, 12pt apart. */
  children: ReactNode;
  /** Animated style on the row content (e.g. a little give as a check lands). */
  contentStyle?: ComponentProps<typeof Animated.View>['style'];
}

/**
 * A pressable row at least 56pt tall, ruled from the next one with `color.rule`.
 * The whole row squeezes a touch on press (the rule stays put).
 */
export function ListRow({ onPress, last, accessibilityLabel, children, contentStyle }: ListRowProps) {
  const press = usePressScale(0.98);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={!last && styles.rule}
    >
      <Animated.View style={press.style}>
        <Animated.View style={[styles.row, contentStyle]}>{children}</Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingVertical: space[2] },
  rule: { borderBottomWidth: border, borderBottomColor: color.rule },
});
