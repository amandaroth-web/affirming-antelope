import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Hoofprint, ProgressRing, Text, color, haptic, space } from '@/design';
import { RollingNumber } from '@/motion';
import { weekdayIndex } from '@/state/store';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Weekly goal ring + the streak as a trail of hoofprints. No leaderboards, no flames. */
export function ThisWeek({
  streak,
  goal,
  weekDays,
}: {
  streak: number;
  goal: { target: number; done: number };
  weekDays: boolean[];
}) {
  const todayIdx = weekdayIndex();
  const hit = goal.done >= goal.target;
  const onFilled = useCallback(() => haptic.success(), []);
  return (
    <Card padding={space[5]}>
      <View style={styles.row}>
        <ProgressRing
          value={goal.done / goal.target}
          size={92}
          stroke={11}
          tint={hit ? color.gold : color.primary}
          delay={250}
          onFilled={onFilled}
          accessibilityLabel={`Weekly goal: ${goal.done} of ${goal.target} practices`}
        >
          <View style={styles.ringCenter}>
            <Text variant="heading" style={styles.ringNum} maxScale={1}>
              {goal.done}
              <Text variant="subheading" color={color.muted} maxScale={1}>
                /{goal.target}
              </Text>
            </Text>
          </View>
        </ProgressRing>
        <View style={styles.copy}>
          <Text variant="label" color={color.muted}>
            This week
          </Text>
          <View style={styles.streakRow} accessible accessibilityLabel={`${streak}-day streak`}>
            <Hoofprint size={26} tint={color.gold} rotate={-12} />
            <RollingNumber value={streak} variant="title" delay={200} />
            <Text variant="subheading" color={color.ink} style={styles.days}>
              day streak
            </Text>
          </View>
          <Text variant="caption" color={color.muted}>
            {hit ? 'Weekly goal met. Nice steady work.' : `${goal.target - goal.done} more to hit your weekly goal`}
          </Text>
        </View>
      </View>
      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {DAYS.map((d, i) => {
          const done = weekDays[i];
          const isToday = i === todayIdx;
          return (
            <View key={i} style={styles.day}>
              <View
                style={[
                  styles.track,
                  done && styles.trackDone,
                  isToday && !done && styles.trackToday,
                ]}
              >
                {done ? (
                  <Hoofprint size={16} tint={color.white} rotate={i % 2 ? 10 : -10} />
                ) : (
                  <Hoofprint size={14} tint={isToday ? color.primaryTint : color.line} rotate={i % 2 ? 10 : -10} />
                )}
              </View>
              <Text variant="caption" color={isToday ? color.primary : color.muted} style={styles.dayLabel}>
                {d}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  ringCenter: { alignItems: 'center' },
  ringNum: { fontSize: 24 },
  copy: { flex: 1, gap: 2 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 },
  days: { marginLeft: 2, marginTop: 4 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[5] },
  day: { alignItems: 'center', gap: 6 },
  track: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
    borderWidth: 2,
    borderColor: color.line,
  },
  trackDone: { backgroundColor: color.gold, borderColor: color.goldShadow, borderBottomWidth: 4 },
  trackToday: { borderColor: color.primary, borderStyle: 'dashed' },
  dayLabel: { fontFamily: 'Nunito_800ExtraBold' },
});
