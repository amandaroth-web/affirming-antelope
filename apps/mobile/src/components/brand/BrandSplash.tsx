import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { color } from '@/design/tokens';
import { spring } from '@/motion/springs';

const LOGO = require('../../../assets/images/splash-icon-deep.png');

/**
 * Continues the native splash (same image, same size, same white) and hands
 * off to the app: the mark dips, springs up, and the curtain lifts while the
 * app rises in underneath. ~650ms total. Reduced motion: a plain cross-fade.
 */
export function BrandSplash({ reduce, onDone }: { reduce: boolean; onDone: () => void }) {
  const scale = useSharedValue(1);
  const curtain = useSharedValue(1);

  useEffect(() => {
    const finish = (f?: boolean) => {
      'worklet';
      if (f) scheduleOnRN(onDone);
    };
    if (reduce) {
      curtain.value = withTiming(0, { duration: 220 }, finish);
      return;
    }
    scale.value = withSequence(
      withTiming(0.9, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(1.08, spring.bouncy),
    );
    curtain.value = withDelay(260, withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) }, finish));
  }, [reduce, scale, curtain, onDone]);

  const wrap = useAnimatedStyle(() => ({ opacity: curtain.value }));
  const mark = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * (1 + (1 - curtain.value) * 0.5) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, wrap]}>
      <Animated.View style={mark}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: color.white, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  logo: { width: 200, height: 200 },
});
