import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { FADE_MS } from '@/motion/constants';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
import { haptic } from './haptics';
import { border, color, radius, space } from './tokens';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Max height as a fraction of the window. */
  maxHeight?: number;
  accessibilityLabel?: string;
  /**
   * Window point the sheet grows out of and returns to (e.g. the centre of the
   * tapped node, from `measureInWindow`). Without it the sheet slides up from the edge.
   */
  origin?: { x: number; y: number };
  /** Face colour of the thing it grows out of: the sheet starts in it and whitens as it docks. */
  originColor?: string;
}

/** Size of the sheet at its origin, pt: a node-sized rounded form (~0.19 × 0.13 of a phone sheet). */
const ORIGIN_SIZE = 72;

/** Rubber band: resistance grows with distance, never exceeds `dim`. */
function rubber(x: number, dim: number) {
  'worklet';
  return (1 - 1 / ((x * 0.55) / dim + 1)) * dim;
}

/**
 * Gesture-driven sheet. Drag down to dismiss (distance or flick), drag up and
 * it rubber-bands. The backdrop dims in step with the sheet's position. Opens
 * on the gentle spring; dismissal carries the finger's velocity.
 *
 * With `origin`, the sheet grows out of that point instead: it starts as a
 * small rounded form (ORIGIN_SIZE, centred on the point, in `originColor`),
 * springs into its docked position while the colour whitens over the front
 * half and the content fades in over the back half. Closing from the scrim or
 * a button shrinks it back into the point; a drag-dismiss keeps carrying the
 * finger down. Reduced motion: no travel, a cross-fade.
 */
export function BottomSheet({ open, onClose, children, maxHeight = 0.88, accessibilityLabel, origin, originColor }: BottomSheetProps) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [mounted, setMounted] = useState(open);
  const h = useSharedValue(winH); // measured sheet height
  const y = useSharedValue(winH); // 0 = fully open
  const fade = useSharedValue(0); // reduced-motion path
  const k = useSharedValue(1); // origin progress: 0 = at the origin, 1 = docked
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const tinted = useSharedValue(0); // 1 while the opening started from an origin with a colour
  const leaving = useSharedValue(0); // 1 while returning to the origin
  const fromOrigin = useRef(false);
  const dragged = useRef(false);
  const shown = useRef(false); // mounted and not yet finished closing

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const finishClose = () => {
    shown.current = false;
    setMounted(false);
  };
  const closeByDrag = () => {
    dragged.current = true;
    onClose();
  };

  // `origin` is read only at the open/close transitions, on purpose: the sheet
  // keeps returning to where it came from even if the caller clears it.
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      haptic.tick();
      dragged.current = false;
      fromOrigin.current = !!origin && !reduce;
      const fresh = !shown.current;
      shown.current = true;
      if (reduce) {
        y.value = 0;
        k.value = 1;
        fade.value = withTiming(1, { duration: FADE_MS });
      } else if (origin) {
        leaving.value = 0;
        ox.value = origin.x;
        oy.value = origin.y;
        tinted.value = originColor ? 1 : 0;
        fade.value = 1;
        y.value = 0;
        if (fresh) k.value = 0;
        k.value = withSpring(1, spring.gentle); // retargets from wherever a close left it
      } else {
        fade.value = 1;
        k.value = 1;
        y.value = withSpring(0, spring.gentle);
      }
    } else {
      const unmount = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(finishClose);
      };
      if (reduce) fade.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, unmount);
      else if (fromOrigin.current && !dragged.current) {
        // the way back: the sheet heads for the node and is gone (transparent, untinted) while still
        // well above node size, so it never sits on the labels as a solid disc; the node's halo
        // breathing out is the "received" beat
        leaving.value = 1;
        k.value = withSpring(0, spring.settle, unmount);
      }
      else y.value = withSpring(h.value + 40, spring.settle, unmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted, reduce, y, h, fade, k, ox, oy, tinted]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const dy = e.translationY;
      y.value = dy >= 0 ? dy : -rubber(-dy, 120);
    })
    .onEnd((e) => {
      const shouldClose = y.value > h.value * 0.28 || e.velocityY > 900;
      if (shouldClose) {
        y.value = withSpring(h.value + 40, { ...spring.settle, velocity: e.velocityY });
        scheduleOnRN(closeByDrag);
      } else {
        y.value = withSpring(0, { ...spring.gentle, velocity: e.velocityY });
      }
    });

  // Read every shared value directly in each worklet (Reanimated web needs it).
  const sheetStyle = useAnimatedStyle(() => {
    const p = Math.max(0, k.value);
    const away = 1 - Math.min(1, p);
    const sh = h.value;
    const round = Math.max(winW, sh) / 2;
    const sx = Math.min(1, ORIGIN_SIZE / winW);
    const sy = Math.min(1, ORIGIN_SIZE / sh);
    return {
      opacity: fade.value * (leaving.value ? interpolate(p, [0.38, 0.75], [0, 1], 'clamp') : interpolate(p, [0, 0.1], [0, 1], 'clamp')),
      borderTopLeftRadius: interpolate(p, [0, 0.7], [round, radius.illustration], 'clamp'),
      borderTopRightRadius: interpolate(p, [0, 0.7], [round, radius.illustration], 'clamp'),
      borderBottomLeftRadius: interpolate(p, [0, 0.7], [round, 0], 'clamp'),
      borderBottomRightRadius: interpolate(p, [0, 0.7], [round, 0], 'clamp'),
      transform: [
        { translateX: (ox.value - winW / 2) * away },
        { translateY: Math.max(-120, y.value) + (oy.value - (winH - sh / 2)) * away },
        { scaleX: sx + (1 - sx) * p },
        { scaleY: sy + (1 - sy) * p },
      ],
    };
  });
  const tintStyle = useAnimatedStyle(() => {
    const p = Math.max(0, k.value);
    const sh = h.value;
    const round = Math.max(winW, sh) / 2;
    return {
      opacity: leaving.value ? 0 : tinted.value * interpolate(p, [0.25, 0.65], [1, 0], 'clamp'),
      borderTopLeftRadius: interpolate(p, [0, 0.7], [round, radius.illustration], 'clamp'),
      borderTopRightRadius: interpolate(p, [0, 0.7], [round, radius.illustration], 'clamp'),
      borderBottomLeftRadius: interpolate(p, [0, 0.7], [round, 0], 'clamp'),
      borderBottomRightRadius: interpolate(p, [0, 0.7], [round, 0], 'clamp'),
    };
  });
  const contentStyle = useAnimatedStyle(() => ({ opacity: leaving.value ? interpolate(k.value, [0.6, 0.95], [0, 1], 'clamp') : interpolate(k.value, [0.5, 1], [0, 1], 'clamp') }));
  const underhangStyle = useAnimatedStyle(() => ({ opacity: interpolate(k.value, [0.85, 1], [0, 1], 'clamp') }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, h.value], [1, 0], 'clamp') * fade.value * Math.min(1, Math.max(0, k.value)),
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
          <Pressable
            style={styles.fill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            onLayout={(e) => {
              h.value = e.nativeEvent.layout.height;
            }}
            style={[
              styles.sheet,
              { maxHeight: winH * maxHeight, paddingBottom: Math.max(insets.bottom, space[4]) + space[2] },
              sheetStyle,
            ]}
          >
            {/* the sheet extends below the screen edge so rubber-banding up never shows a gap */}
            <Animated.View style={[styles.underhang, underhangStyle]} />
            <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: originColor ?? color.white }, tintStyle]} />
            <Animated.View style={contentStyle}>
              <View style={styles.handleZone}>
                <View style={styles.handle} />
              </View>
              {children}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { backgroundColor: color.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.white,
    borderTopLeftRadius: radius.illustration,
    borderTopRightRadius: radius.illustration,
    borderWidth: border,
    borderBottomWidth: 0,
    borderColor: color.line,
    paddingHorizontal: space[5],
  },
  tint: { position: 'absolute', left: -border, right: -border, top: -border, bottom: -border },
  underhang: { position: 'absolute', left: -2, right: -2, bottom: -160, height: 162, backgroundColor: color.white },
  handleZone: { alignItems: 'center', paddingTop: space[3], paddingBottom: space[4] },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: color.line },
});
