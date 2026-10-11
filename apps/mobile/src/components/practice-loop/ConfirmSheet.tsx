import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Text, color, space } from '@/design';

/**
 * Two-way confirmation in a sheet. The safe, keep-going choice is primary;
 * the leaving choice is secondary, never red.
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  stay,
  leave,
  onLeave,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  stay: string;
  leave: string;
  onLeave: () => void;
  /** The leaving choice is working (e.g. saving before sign-out): both buttons wait. */
  busy?: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} accessibilityLabel={title}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" color={color.muted} style={styles.body}>
        {body}
      </Text>
      <View style={styles.actions}>
        <Button label={stay} fullWidth onPress={onClose} disabled={busy} />
        <Button variant="secondary" label={busy ? 'Saving…' : leave} fullWidth onPress={onLeave} disabled={busy} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: space[2] },
  actions: { marginTop: space[5], gap: space[3] },
});
