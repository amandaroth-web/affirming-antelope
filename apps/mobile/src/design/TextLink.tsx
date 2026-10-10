import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { CaretRightIcon } from './icons';
import { Text } from './Text';
import { color } from './tokens';

export interface TextLinkProps {
  label: string;
  onPress: () => void;
  /** A trailing caret: this link goes somewhere ("Week 4 of 12 ›"). */
  caret?: boolean;
  hitSlop?: number;
  /** `link` when it navigates, `button` when it acts. */
  role?: 'link' | 'button';
  /** Entering animation for the label; the label re-mounts (and enters) whenever it changes. */
  entering?: ComponentProps<typeof Animated.View>['entering'];
  style?: StyleProp<ViewStyle>;
}

/**
 * Quiet cobalt text action, secondary to a docked primary or a section title.
 * 44pt tall so it's easy to hit without looking like a button.
 */
export function TextLink({ label, onPress, caret, hitSlop = 6, role = 'button', entering, style }: TextLinkProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole={role} accessibilityLabel={label} hitSlop={hitSlop} style={[styles.link, style]}>
      <Animated.View key={label} entering={entering}>
        <Text variant="label" color={color.primary}>
          {label}
        </Text>
      </Animated.View>
      {caret ? <CaretRightIcon size={14} weight="bold" color={color.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 44 },
});
