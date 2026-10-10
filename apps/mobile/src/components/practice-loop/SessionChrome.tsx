import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, XIcon, color, layout, space } from '@/design';
import { DismissZone } from './SessionSurface';

/**
 * Shared chrome for the practice-loop screens (lesson, drill, role-play):
 * a close X at top left, an optional centre and trailing slot, and a docked
 * bottom bar for the one primary action. Inside a SessionSurface the header
 * is also the drag handle: pull it down to dismiss.
 */
export function SessionHeader({
  onClose,
  closeLabel = 'Close',
  center,
  trailing,
  style,
}: {
  onClose: () => void;
  closeLabel?: string;
  center?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <DismissZone>
      <View style={[styles.header, { paddingTop: insets.top + space[2] }, style]}>
        <View style={styles.headerRow}>
          <IconButton onPress={onClose} label={closeLabel} icon={<XIcon size={26} weight="bold" color={color.muted} />} />
          <View style={styles.center}>{center}</View>
          <View style={styles.trailing}>{trailing}</View>
        </View>
      </View>
    </DismissZone>
  );
}

/** Bottom bar for the screen's primary action. Sits above the home indicator. */
export function Dock({ children, style, rule = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; rule?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.dock, rule && styles.dockRule, { paddingBottom: Math.max(insets.bottom, space[3]) + space[2] }, style]}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

/**
 * Keyboard handling that works in Expo Go and on web: the screen's column
 * (scroll + dock) lifts with the keyboard on iOS and Android (edge-to-edge),
 * and is a plain flex column on web where the browser handles it.
 */
export function KeyboardColumn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  if (Platform.OS === 'web') return <View style={[styles.fill, style]}>{children}</View>;
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.fill, style]}>
      {children}
    </KeyboardAvoidingView>
  );
}

export const sessionStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  scroll: { paddingHorizontal: layout.gutter },
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: layout.gutter - 10, paddingBottom: space[2], backgroundColor: color.white, zIndex: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: space[2], width: '100%', maxWidth: layout.maxWidth + 20, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  trailing: { minWidth: 44, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 10 },
  dock: { backgroundColor: color.white, paddingHorizontal: layout.gutter, paddingTop: space[3] },
  dockRule: { borderTopWidth: 2, borderTopColor: color.line },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
});
