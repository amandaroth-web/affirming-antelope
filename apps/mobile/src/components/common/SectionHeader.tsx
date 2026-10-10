import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CaretRightIcon, Text, color, space } from '@/design';
import { useTickSwap } from '@/motion';

/**
 * Section title with an optional quiet link on the right. When the link text
 * changes ("Week 3 of 12" → "Week 4 of 12") it ticks over; never on mount.
 */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const tick = useTickSwap();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <View style={styles.row}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link" accessibilityLabel={action} style={styles.link}>
          <Animated.View key={action} entering={mounted.current ? tick.entering : undefined}>
            <Text variant="label" color={color.primary}>
              {action}
            </Text>
          </Animated.View>
          <CaretRightIcon size={14} weight="bold" color={color.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[8],
    marginBottom: space[3],
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
});
