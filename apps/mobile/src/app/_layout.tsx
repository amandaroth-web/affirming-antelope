import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BrandSplash } from '@/components/brand/BrandSplash';
import { useBrandFonts } from '@/design/fonts';
import { color } from '@/design/tokens';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
import { useLearner } from '@/state/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

const SESSION = {
  presentation: 'transparentModal',
  animation: 'none',
  gestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
} as const;

function useHydrated() {
  const [done, setDone] = useState(() => useLearner.persist.hasHydrated());
  useEffect(() => {
    if (done) return;
    const unsub = useLearner.persist.onFinishHydration(() => setDone(true));
    if (useLearner.persist.hasHydrated()) setDone(true);
    return unsub;
  }, [done]);
  return done;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useBrandFonts();
  const hydrated = useHydrated();
  const ready = (fontsLoaded || !!fontError) && hydrated;
  const reduce = useReduceMotion();
  const [splashGone, setSplashGone] = useState(false);
  const rise = useSharedValue(0);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    rise.value = reduce ? 1 : withSpring(1, spring.gentle);
  }, [ready, reduce, rise]);

  const onSplashDone = useCallback(() => setSplashGone(true), []);
  const app = useAnimatedStyle(() => ({ transform: [{ scale: 0.97 + 0.03 * rise.value }] }));

  if (!ready) return <View style={styles.root} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <Animated.View style={[styles.root, app]}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.white } }}>
          <Stack.Screen name="(tabs)" />
          {/* Practice screens: transparent modals with no native animation. SessionSurface owns the
              transition (container transform from the source, swipe-down dismiss, collapse on close). */}
          <Stack.Screen name="drill/[id]" options={SESSION} />
          <Stack.Screen name="roleplay/[scenarioId]" options={SESSION} />
          <Stack.Screen name="lesson/[id]" options={SESSION} />
        </Stack>
      </Animated.View>
      {!splashGone && <BrandSplash reduce={reduce} onDone={onSplashDone} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: color.white } });
