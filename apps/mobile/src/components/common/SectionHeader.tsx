import { Pressable, StyleSheet, View } from 'react-native';
import { CaretRightIcon, Text, color, space } from '@/design';

/** Section title with an optional quiet link on the right. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link" accessibilityLabel={action} style={styles.link}>
          <Text variant="label" color={color.primary}>
            {action}
          </Text>
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
