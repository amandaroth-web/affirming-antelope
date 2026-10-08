import { useEffect, useState, type ReactNode } from 'react';
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
}

/** Rubber band: resistance grows with distance, never exceeds `dim`. */
function rubber(x: number, dim: number) {
  'worklet';
  return (1 - 1 / ((x * 0.55) / dim + 1)) * dim;
}

/**
 * Gesture-driven sheet. Drag down to dismiss (distance or flick), drag up and
 * it rubber-bands. The backdrop dims in step with the sheet's position. Opens
 * on the gentle spring; dismissal carries the finger's velocity.
 */
export function BottomSheet({ open, onClose, children, maxHeight = 0.88, accessibilityLabel }: BottomSheetProps) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [mounted, setMounted] = useState(open);
  const h = useSharedValue(winH); // measured sheet height
  const y = useSharedValue(winH); // 0 = fully open
  const fade = useSharedValue(0); // reduced-motion path

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      haptic.tick();
      if (reduce) {
        y.value = 0;
        fade.value = withTiming(1, { duration: FADE_MS });
      } else {
        fade.value = 1;
        y.value = withSpring(0, spring.gentle);
      }
    } else {
      const unmount = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(setMounted, false);
      };
      if (reduce) fade.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, unmount);
      else y.value = withSpring(h.value + 40, spring.settle, unmount);
    }
  }, [open, mounted, reduce, y, h, fade]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const dy = e.translationY;
      y.value = dy >= 0 ? dy : -rubber(-dy, 120);
    })
    .onEnd((e) => {
      const shouldClose = y.value > h.value * 0.28 || e.velocityY > 900;
      if (shouldClose) {
        y.value = withSpring(h.value + 40, { ...spring.settle, velocity: e.velocityY });
        scheduleOnRN(onClose);
      } else {
        y.value = withSpring(0, { ...spring.gentle, velocity: e.velocityY });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(-120, y.value) }],
    opacity: fade.value,
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, h.value], [1, 0], 'clamp') * fade.value,
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
            <View style={styles.underhang} />
            <View style={styles.handleZone}>
              <View style={styles.handle} />
            </View>
            {children}
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
  underhang: { position: 'absolute', left: -2, right: -2, bottom: -160, height: 162, backgroundColor: color.white },
  handleZone: { alignItems: 'center', paddingTop: space[3], paddingBottom: space[4] },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: color.line },
});
