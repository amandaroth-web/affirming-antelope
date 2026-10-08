import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useEntrance, type EntranceOptions } from './useEntrance';

/** Wrap any block to give it a staggered entrance. */
export function Enter({ children, style, ...opts }: PropsWithChildren<EntranceOptions & { style?: StyleProp<ViewStyle> }>) {
  const a = useEntrance(opts);
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}
