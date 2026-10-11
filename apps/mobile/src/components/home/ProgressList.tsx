import { getSkillLevel, type DemoSkillProgress, type SkillId, type SkillLevelNumber } from '@antelope/core';
import { StyleSheet, View } from 'react-native';
import { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LevelPips, Raised, StepBadge, Text, border, color, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';
import type { ProgressRow } from '@/state/selectors';
import { useLearner } from '@/state/store';
import { TickSwap, useOnChange } from './motion';

/**
 * The course's core processes with their level state. One card, ruled rows.
 * On change: pips spring to the new fill, a new level or a completed process
 * pops its badge and ticks its caption over. Rows never change height. No
 * percentages: skills are shown as levels.
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

  // badge content changed (new level, unlocked, completed): it pops like a stamp
  const pop = useSharedValue(1);
  useOnChange(`${r.status}-${p.level}`, () => {
    pop.value = reduce
      ? withSequence(withTiming(0.35, { duration: 0 }), withTiming(1, { duration: FADE_MS }))
      : withSequence(withTiming(0.7, { duration: 90, easing: Easing.out(Easing.quad) }), withSpring(1, spring.bouncy));
  });
  const badgeStyle = useAnimatedStyle(() => (reduce ? { opacity: pop.value } : { transform: [{ scale: pop.value }] }));

  const caption = locked ? (r.opensWeek ? `Opens in week ${r.opensWeek}` : 'Not on this track') : `Level ${p.level} · ${level.name}`;
  // what the pips are heading for; the last level has no next
  const next = !locked && !complete && p.level < 6 ? `Next: ${getSkillLevel((p.level + 1) as SkillLevelNumber).name}` : null;

  return (
    <View
      style={[styles.row, !last && styles.rule]}
      accessible
      accessibilityLabel={
        locked
          ? `${r.label}, locked`
          : complete
            ? `${r.label}, complete, level ${p.level} ${level.name}`
            : `${r.label}, level ${p.level} ${level.name}${next ? `, ${next.toLowerCase()}` : ''}`
      }
    >
      <StepBadge shape="square" state={complete ? 'done' : locked ? 'locked' : 'level'} label={p.level} style={badgeStyle} />
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
          percent={complete ? 100 : p.percent}
          state={locked ? 'locked' : complete ? 'complete' : 'progress'}
          pipWidth={10}
          height={7}
          gap={3}
          delay={300 + i * 60}
        />
        {complete || locked ? (
          <Text variant="captionStrong" color={complete ? color.goldInk : color.faint}>
            {complete ? 'Done' : 'Locked'}
          </Text>
        ) : next ? (
          <TickSwap value={next}>
            <Text variant="captionStrong" color={color.primaryShadow}>
              {next}
            </Text>
          </TickSwap>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { paddingHorizontal: space[4], paddingVertical: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] + 2 },
  rule: { borderBottomWidth: border, borderBottomColor: color.rule },
  copy: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
});
