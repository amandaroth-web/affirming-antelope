import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { Hoofprint, ProgressRing, Raised, Text, color, haptic, space } from '@/design';
import { Enter, RollingNumber } from '@/motion';
import { useLearner } from '@/state/store';

export interface PracticeSnapshot {
  streak: number;
  goalDone: number;
  goalTarget: number;
}

/** Streak and weekly goal as they were when the screen opened, so completion can show the tick. */
export function usePracticeSnapshot(): PracticeSnapshot {
  const [snap] = useState(() => {
    const s = useLearner.getState();
    return { streak: s.streak.days, goalDone: s.weeklyGoal.done, goalTarget: s.weeklyGoal.target };
  });
  return snap;
}

export function useLivePractice(): PracticeSnapshot {
  const streak = useLearner((s) => s.streak.days);
  const goal = useLearner((s) => s.weeklyGoal);
  return { streak, goalDone: goal.done, goalTarget: goal.target };
}

/**
 * The streak hoofprint rolling to its new number and the weekly ring
 * advancing. Used full-size on drill/lesson completion and as a compact strip
 * at the top of the debrief.
 */
export function PracticeTicks({ before, compact, delay = 450 }: { before: PracticeSnapshot; compact?: boolean; delay?: number }) {
  const after = useLivePractice();
  const [ring, setRing] = useState(Math.min(1, before.goalDone / before.goalTarget));
  const goalNow = Math.min(1, after.goalDone / after.goalTarget);
  const justHit = before.goalDone < before.goalTarget && after.goalDone >= after.goalTarget;

  useEffect(() => {
    const t = setTimeout(() => setRing(goalNow), delay + 500);
    const h = setTimeout(() => {
      if (after.streak > before.streak) haptic.success();
    }, delay + 260);
    return () => {
      clearTimeout(t);
      clearTimeout(h);
    };
  }, [goalNow, delay, after.streak, before.streak]);

  const size = compact ? 44 : 64;
  return (
    <View style={[styles.ticks, compact && styles.ticksCompact]}>
      <Raised tone="surface" depth={4} style={styles.stat} contentStyle={[styles.statFace, compact && styles.statFaceCompact]}>
        <Hoofprint size={compact ? 26 : 34} tint={color.gold} rotate={-12} />
        <View style={compact ? undefined : styles.centered}>
          <RollingNumber value={after.streak} from={before.streak} delay={delay} variant={compact ? 'heading' : 'number'} color={color.ink} />
          <Text variant="caption" color={color.muted}>
            day streak
          </Text>
        </View>
      </Raised>
      <Raised tone="surface" depth={4} style={styles.stat} contentStyle={[styles.statFace, compact && styles.statFaceCompact]}>
        <ProgressRing
          value={ring}
          size={size}
          stroke={compact ? 7 : 9}
          tint={goalNow >= 1 ? color.gold : color.primary}
          onFilled={justHit ? haptic.success : undefined}
          accessibilityLabel={`Weekly goal: ${after.goalDone} of ${after.goalTarget}`}
        >
          <Text variant={compact ? 'caption' : 'label'} color={color.ink}>
            {Math.min(after.goalDone, after.goalTarget)}/{after.goalTarget}
          </Text>
        </ProgressRing>
        <View style={[styles.shrink, !compact && styles.centered]}>
          <Text variant="label">{justHit ? 'Goal hit' : 'Weekly goal'}</Text>
          <Text variant="caption" color={color.muted} numberOfLines={2}>
            {after.goalDone >= after.goalTarget ? 'Done this week' : `${after.goalTarget - after.goalDone} to go`}
          </Text>
        </View>
      </Raised>
    </View>
  );
}

/** Full-screen completion: the antelope celebrates, the ticks land, then the actions. */
export function CompletionMoment({
  title,
  subtitle,
  before,
  children,
}: {
  title: string;
  subtitle: string;
  before: PracticeSnapshot;
  children?: ReactNode;
}) {
  const focused = useIsFocused();
  const mascot = useRef<MascotHandle>(null);
  const [cheer, setCheer] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setCheer(false), 3200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Enter from="scale">
          <Mascot ref={mascot} pose="celebrate" mood={cheer ? 'cheer' : 'idle'} size={168} paused={!focused} accessibilityLabel="The antelope coach, celebrating" />
        </Enter>
        <Enter index={2} style={styles.copy}>
          <Text variant="title" align="center" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" color={color.muted} align="center">
            {subtitle}
          </Text>
        </Enter>
        <Enter index={4} style={styles.full}>
          <PracticeTicks before={before} delay={650} />
        </Enter>
      </View>
      {children ? <Enter index={6}>{children}</Enter> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[5] },
  copy: { alignItems: 'center', gap: space[2], paddingHorizontal: space[4] },
  full: { alignSelf: 'stretch' },
  ticks: { flexDirection: 'row', gap: space[3] },
  ticksCompact: { gap: space[2] },
  stat: { flex: 1 },
  statFace: { alignItems: 'center', gap: space[2], padding: space[4] },
  statFaceCompact: { flexDirection: 'row', padding: space[3], gap: space[2] },
  shrink: { flexShrink: 1 },
  centered: { alignItems: 'center' },
});
