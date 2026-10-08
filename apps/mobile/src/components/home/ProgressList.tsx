import { getSkillLevel } from '@antelope/core';
import { StyleSheet, View } from 'react-native';
import { CheckIcon, LevelPips, LockSimpleIcon, Raised, Text, color, space } from '@/design';
import type { ProgressRow } from '@/state/selectors';
import { useLearner } from '@/state/store';

/** The course's core processes with their level state. One card, ruled rows. */
export function ProgressList({ rows }: { rows: ProgressRow[] }) {
  const skills = useLearner((s) => s.skills);
  return (
    <Raised contentStyle={styles.face}>
      {rows.map((r, i) => {
        const p = skills[r.skill];
        const level = getSkillLevel(p.level);
        const locked = r.status === 'locked';
        const complete = r.status === 'complete';
        return (
          <View
            key={r.key}
            style={[styles.row, i < rows.length - 1 && styles.rule]}
            accessible
            accessibilityLabel={
              locked
                ? `${r.label}, locked`
                : complete
                  ? `${r.label}, complete, level ${p.level} ${level.name}`
                  : `${r.label}, ${r.percent}% through level ${p.level} ${level.name}`
            }
          >
            <View style={[styles.badge, complete && styles.badgeDone, locked && styles.badgeLocked]}>
              {complete ? (
                <CheckIcon size={16} weight="bold" color={color.white} />
              ) : locked ? (
                <LockSimpleIcon size={15} weight="bold" color={color.faint} />
              ) : (
                <Text variant="caption" color={color.primary} style={styles.badgeNum} maxScale={1}>
                  {p.level}
                </Text>
              )}
            </View>
            <View style={styles.copy}>
              <Text variant="bodyStrong" color={locked ? color.muted : color.ink}>
                {r.label}
              </Text>
              <Text variant="caption" color={color.muted}>
                {locked ? 'Opens in week 7' : `Level ${p.level} · ${level.name}`}
              </Text>
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
              <Text
                variant="caption"
                color={complete ? '#8A5A0B' : locked ? color.faint : color.primaryShadow}
                style={styles.status}
              >
                {complete ? 'Done' : locked ? 'Locked' : `${r.percent}%`}
              </Text>
            </View>
          </View>
        );
      })}
    </Raised>
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
  status: { fontFamily: 'Nunito_800ExtraBold' },
});
