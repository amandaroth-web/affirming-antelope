import { getSkillLevel, type DemoSkillProgress, type SkillId } from '@antelope/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { CheckIcon, LevelPips, LockSimpleIcon, Raised, Text, color, space } from '@/design';
import { FADE_MS, RollingNumber, spring, useReduceMotion } from '@/motion';
import type { ProgressRow } from '@/state/selectors';
import { useLearner } from '@/state/store';
import { TickSwap, useOnChange } from './motion';

/**
 * The course's core processes with their level state. One card, ruled rows.
 * On change: pips spring to the new fill, the percent rolls, a new level or a
 * completed process pops its badge and ticks its caption over. Rows never change height.
 */
export function ProgressList({ rows, skills: skillsProp }: { rows: ProgressRow[]; skills?: Record<SkillId, DemoSkillProgress> }) {
  const live = useLearner((s) => s.skills);
  const skills = skillsProp ?? live;
  return (
    <Raised contentStyle={styles.face}>
      {rows.map((r, i) => (
        <Row key={r.key} row={r} progress={skills[r.skill]} index={i} last={i === rows.length - 1} />
      ))}
    </Raised>
  );
}

function Row({ row: r, progress: p, index: i, last }: { row: ProgressRow; progress: DemoSkillProgress; index: number; last: boolean }) {
  const reduce = useReduceMotion();
  const level = getSkillLevel(p.level);
  const locked = r.status === 'locked';
  const complete = r.status === 'complete';
  const [percentAtMount] = useState(r.percent);

  // badge content changed (new level, unlocked, completed): it pops like a stamp
  const pop = useSharedValue(1);
  useOnChange(`${r.status}-${p.level}`, () => {
    pop.value = reduce
      ? withSequence(withTiming(0.35, { duration: 0 }), withTiming(1, { duration: FADE_MS }))
      : withSequence(withTiming(0.7, { duration: 90, easing: Easing.out(Easing.quad) }), withSpring(1, spring.bouncy));
  });
  const badgeStyle = useAnimatedStyle(() => (reduce ? { opacity: pop.value } : { transform: [{ scale: pop.value }] }));

  const caption = locked ? 'Opens in week 7' : `Level ${p.level} · ${level.name}`;

  return (
    <View
      style={[styles.row, !last && styles.rule]}
      accessible
      accessibilityLabel={
        locked
          ? `${r.label}, locked`
          : complete
            ? `${r.label}, complete, level ${p.level} ${level.name}`
            : `${r.label}, ${r.percent}% through level ${p.level} ${level.name}`
      }
    >
      <Animated.View style={[styles.badge, complete && styles.badgeDone, locked && styles.badgeLocked, badgeStyle]}>
        {complete ? (
          <CheckIcon size={16} weight="bold" color={color.white} />
        ) : locked ? (
          <LockSimpleIcon size={15} weight="bold" color={color.faint} />
        ) : (
          <Text variant="caption" color={color.primary} style={styles.badgeNum} maxScale={1}>
            {p.level}
          </Text>
        )}
      </Animated.View>
      <View style={styles.copy}>
        <Text variant="bodyStrong" color={locked ? color.muted : color.ink}>
          {r.label}
        </Text>
        <TickSwap value={caption}>
          <Text variant="caption" color={color.muted}>
            {caption}
          </Text>
        </TickSwap>
      </View>
      <View style={styles.right}>
        <LevelPips
          level={p.level}
          percent={complete ? 100 : r.percent}
          state={locked ? 'locked' : complete ? 'complete' : 'progress'}
          pipWidth={10}
          height={7}
          gap={3}
          delay={300 + i * 60}
        />
        {complete || locked ? (
          <Text variant="caption" color={complete ? '#8A5A0B' : color.faint} style={styles.status}>
            {complete ? 'Done' : 'Locked'}
          </Text>
        ) : (
          <View style={styles.percent}>
            <RollingNumber
              value={r.percent}
              from={percentAtMount}
              variant="caption"
              color={color.primaryShadow}
              delay={300 + i * 60}
              style={styles.status}
            />
            <Text variant="caption" color={color.primaryShadow} style={styles.status}>
              %
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { paddingHorizontal: space[4], paddingVertical: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] + 2 },
  rule: { borderBottomWidth: 2, borderBottomColor: color.soft },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.soft,
    borderWidth: 2,
    borderColor: color.primaryTint,
  },
  badgeDone: { backgroundColor: color.gold, borderColor: color.goldShadow },
  badgeLocked: { backgroundColor: color.white, borderColor: color.line },
  badgeNum: { fontFamily: 'Fredoka_700Bold', fontSize: 15 },
  copy: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
  percent: { flexDirection: 'row' },
  status: { fontFamily: 'Nunito_800ExtraBold' },
});
