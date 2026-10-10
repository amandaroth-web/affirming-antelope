import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextLink, color, space } from '@/design';
import { useTickSwap } from '@/motion';

/**
 * Section title with an optional action slot on the right. With `onAction` the
 * slot is a quiet link; without it, a muted note ("Focus this week: Sustain
 * talk"). When the text changes ("Week 3 of 12" → "Week 4 of 12") it ticks
 * over; never on mount.
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
        <TextLink label={action} onPress={onAction} caret hitSlop={10} role="link" entering={mounted.current ? tick.entering : undefined} />
      ) : action ? (
        <Text variant="caption" color={color.muted} align="right" style={styles.note}>
          {action}
        </Text>
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
  note: { flexShrink: 1, marginLeft: space[3] },
});
