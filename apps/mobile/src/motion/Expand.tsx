import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { FADE_MS } from './constants';
import { spring } from './springs';
import { useReduceMotion } from './useMotionPrefs';

/**
 * Animated auto-height. Content is measured off-flow, then the container
 * springs its real layout height, so everything below moves with it on the
 * same frame (no jump, no overlap). Use for anything that opens in place:
 * explanations under a tile, a coach reaction, an error card.
 *
 * - `open` false collapses to 0. Changing content while open springs to the new height.
 * - `appear` (default true): when mounted open, grow from 0 instead of starting open.
 * Reduced motion: height snaps, contents cross-fade.
 */
export function Expand({
  open = true,
  appear = true,
  delay = 0,
  children,
  style,
}: {
  open?: boolean;
  appear?: boolean;
  delay?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const [h, setH] = useState(-1);
  const height = useSharedValue(0);
  const fade = useSharedValue(open && !appear ? 1 : 0);
  const first = useRef(true);

  useEffect(() => {
    if (h < 0) return;
    const to = open ? h : 0;
    if (reduce || (first.current && !appear && open)) {
      height.value = to;
    } else {
      height.value = withDelay(first.current ? delay : 0, withSpring(to, spring.settle));
    }
    const fadeTo = open ? 1 : 0;
    fade.value = reduce
      ? withTiming(fadeTo, { duration: FADE_MS })
      : withDelay(open && first.current ? delay + 60 : 0, withTiming(fadeTo, { duration: open ? 220 : 120, easing: Easing.out(Easing.quad) }));
    first.current = false;
  }, [h, open, reduce, appear, delay, height, fade]);

  const box = useAnimatedStyle(() => ({ height: height.value }));
  const inner = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View style={[styles.clip, style, box]}>
      <Animated.View style={[styles.measure, inner]} onLayout={(e) => setH(Math.round(e.nativeEvent.layout.height))}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, right: 0, top: 0 },
});
