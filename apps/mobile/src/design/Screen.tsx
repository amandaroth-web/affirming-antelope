import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, layout, space } from './tokens';

/** Tab screen scaffold: safe top inset, gutter, room for the floating tab bar. */
export function Screen({ children, header, contentContainerStyle, ...rest }: ScrollViewProps & { children: ReactNode; header?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      {header}
      <ScrollView
        {...rest}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: header ? space[2] : insets.top + space[4], paddingBottom: insets.bottom + layout.tabBarHeight + space[8] },
          contentContainerStyle,
        ]}
      >
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  content: { paddingHorizontal: layout.gutter },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
});
