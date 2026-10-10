import type { ReactNode } from 'react';
import { StyleSheet, View, type ScrollViewProps } from 'react-native';
import Animated, { type ScrollHandlerProcessed } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, layout, space } from './tokens';

export interface ScreenProps extends Omit<ScrollViewProps, 'onScroll'> {
  children: ReactNode;
  /** Fixed content above the scroll view (it pushes the scroll view down). */
  header?: ReactNode;
  /**
   * Floating content drawn over the scroll view, e.g. a compact title bar that
   * appears on scroll. Position it yourself (absolute, top 0).
   */
  overlay?: ReactNode;
  /** A plain JS scroll listener. */
  onScroll?: ScrollViewProps['onScroll'];
  /** A `useAnimatedScrollHandler()` result: scroll-linked motion on the UI thread. Wins over `onScroll`. */
  scrollHandler?: ScrollHandlerProcessed<Record<string, unknown>>;
}

/** Tab screen scaffold: safe top inset, gutter, room for the floating tab bar. */
export function Screen({ children, header, overlay, contentContainerStyle, onScroll, scrollHandler, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      {header}
      <Animated.ScrollView
        {...rest}
        onScroll={scrollHandler ?? onScroll}
        scrollEventThrottle={scrollHandler ? 16 : rest.scrollEventThrottle}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: header ? space[2] : insets.top + space[4], paddingBottom: insets.bottom + layout.tabBarHeight + space[8] },
          contentContainerStyle,
        ]}
      >
        <View style={styles.column}>{children}</View>
      </Animated.ScrollView>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  content: { paddingHorizontal: layout.gutter },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
});
