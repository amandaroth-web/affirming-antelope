import type { PropsWithChildren } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useEntrance, type EntranceOptions } from './useEntrance';

/** Wrap any block to give it a staggered entrance. */
export function Enter({
  children,
  style,
  onLayout,
  ...opts
}: PropsWithChildren<EntranceOptions & { style?: StyleProp<ViewStyle>; onLayout?: (e: LayoutChangeEvent) => void }>) {
  const a = useEntrance(opts);
  return (
    <Animated.View style={[style, a]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}
