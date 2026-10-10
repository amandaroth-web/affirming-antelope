import { getSkillLevel, type Skill } from '@antelope/core';
import type { DemoSkillProgress } from '@antelope/core';
import { useEffect, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { CheckIcon, LevelPips, PressableSurface, Text, color, radius, space } from '@/design';
import { spring, useReduceMotion } from '@/motion';

/** Selectable skill with its current level. Selection pops the check badge in. */
export function SkillTile({
  skill,
  progress,
  selected,
  onPress,
  heroRefs,
}: {
  skill: Skill;
  progress: DemoSkillProgress;
  selected: boolean;
  onPress: () => void;
  /** Practice's START launches the session out of the selected tile (see motion/launch). */
  heroRefs?: { card: RefObject<View | null>; title: RefObject<View | null> };
}) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    pop.value = reduce ? (selected ? 1 : 0) : selected ? withSequence(withSpring(1.2, spring.snappy), withSpring(1, spring.bouncy)) : withSpring(0, spring.snappy);
  }, [selected, reduce, pop]);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }], opacity: Math.min(1, pop.value * 2) }));
  const fresh = progress.status === 'locked';
  const lvl = getSkillLevel(progress.level);

  return (
    <View ref={heroRefs?.card} collapsable={false} style={styles.tile}>
    <PressableSurface
      onPress={onPress}
      haptic="tick"
      tone={selected ? 'soft' : 'surface'}
      edge={selected ? color.primary : undefined}
      shadow={selected ? color.primary : undefined}
      depth={4}
      radius={radius.surface}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${skill.name}, ${fresh ? 'not started' : `level ${progress.level}, ${lvl.name}`}`}
      style={styles.fill}
      contentStyle={styles.face}
    >
      <View ref={heroRefs?.title} collapsable={false} style={styles.name}>
        <Text variant="subheading" color={selected ? color.primaryShadow : color.ink} numberOfLines={2}>
          {skill.name}
        </Text>
      </View>
      <Text variant="caption" color={color.muted}>
        {fresh ? 'Not started' : `Level ${progress.level} · ${lvl.name}`}
      </Text>
      <View style={styles.pips}>
        <LevelPips
          level={progress.level}
          percent={progress.percent}
          state={fresh ? 'locked' : progress.status === 'complete' ? 'complete' : 'progress'}
          pipWidth={11}
          height={6}
          gap={3}
        />
      </View>
      <Animated.View style={[styles.badge, badge]} pointerEvents="none">
        <CheckIcon size={13} weight="bold" color={color.white} />
      </Animated.View>
    </PressableSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: '48%', flexGrow: 1 },
  face: { padding: space[4], paddingRight: space[6], minHeight: 104 },
  fill: { flexGrow: 1 },
  name: { marginBottom: 2, alignSelf: 'flex-start' },
  pips: { marginTop: space[3] },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
