import type { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '@/design/haptics';
import { HouseIcon, PathIcon, TargetIcon, UserIcon } from '@/design/icons';
import { Text } from '@/design/Text';
import { border, color, layout } from '@/design/tokens';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const META: Record<string, { label: string; Icon: typeof HouseIcon }> = {
  index: { label: 'Home', Icon: HouseIcon },
  path: { label: 'Path', Icon: PathIcon },
  practice: { label: 'Practice', Icon: TargetIcon },
  me: { label: 'Me', Icon: UserIcon },
};

const PILL_W = 60;
const PILL_H = 34;

/**
 * Custom tab bar. A periwinkle pill slides under the active icon on the snappy
 * spring (stretching while it travels); the icon pops with a bouncy spring and
 * a selection tick.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const count = state.routes.length;
  const tabW = w / count;
  const x = useSharedValue(0);
  const stretch = useSharedValue(1);

  useEffect(() => {
    if (!tabW) return;
    const to = state.index * tabW + (tabW - PILL_W) / 2;
    if (reduce) {
      x.value = to;
      return;
    }
    x.value = withSpring(to, spring.snappy);
    stretch.value = withSequence(withSpring(1.35, spring.snappy), withSpring(1, spring.bouncy));
  }, [state.index, tabW, reduce, x, stretch]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scaleX: stretch.value }] }));

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom, height: layout.tabBarHeight + insets.bottom }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {tabW > 0 && <Animated.View pointerEvents="none" style={[styles.pill, pill]} />}
      {state.routes.map((route, i) => {
        const meta = META[route.name] ?? { label: route.name, Icon: HouseIcon };
        const focused = state.index === i;
        return (
          <Tab
            key={route.key}
            label={meta.label}
            Icon={meta.Icon}
            focused={focused}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) {
                haptic.tick();
                navigation.navigate(route.name, route.params);
              }
            }}
          />
        );
      })}
    </View>
  );
}

function Tab({ label, Icon, focused, onPress }: { label: string; Icon: typeof HouseIcon; focused: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(1);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (!focused || reduce) return;
    pop.value = withSequence(withSpring(1.22, spring.snappy), withSpring(1, spring.bouncy));
    lift.value = withSequence(withSpring(-3, spring.snappy), withSpring(0, spring.bouncy));
  }, [focused, reduce, pop, lift]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }, { scale: pop.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tab}
    >
      <Animated.View style={[styles.iconBox, iconStyle]}>
        <Icon size={26} weight={focused ? 'fill' : 'bold'} color={focused ? color.primary : color.muted} />
      </Animated.View>
      <Text variant="caption" color={focused ? color.primary : color.muted} style={styles.label} maxScale={1.15}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: color.white,
    borderTopWidth: border,
    borderTopColor: color.line,
  },
  pill: {
    position: 'absolute',
    top: 7,
    left: 0,
    width: PILL_W,
    height: PILL_H,
    borderRadius: 14,
    backgroundColor: color.soft,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 11, minHeight: layout.minHit },
  iconBox: { height: 26, justifyContent: 'center' },
  label: { marginTop: 5, fontFamily: 'Nunito_800ExtraBold', fontSize: 12, lineHeight: 14 },
});
