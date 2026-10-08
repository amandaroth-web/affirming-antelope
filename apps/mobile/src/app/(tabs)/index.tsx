import { getSkill, type DemoAssignmentItem } from '@antelope/core';
import { DEMO_LEARNER } from '@antelope/core';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SectionHeader } from '@/components/common/SectionHeader';
import { AssignmentCard } from '@/components/home/AssignmentCard';
import { PracticeTiles } from '@/components/home/PracticeTiles';
import { ProgressList } from '@/components/home/ProgressList';
import { ThisWeek } from '@/components/home/ThisWeek';
import { TodayHero } from '@/components/home/TodayHero';
import { Mascot } from '@/components/mascot';
import { ChatsCircleIcon, LightningIcon, Screen, ShuffleIcon, SparkleIcon, Text, color, space } from '@/design';
import { openDrill, openRoleplay, pickDrill, pickScenario } from '@/data/routes';
import { Enter } from '@/motion';
import { TOTAL_WEEKS, useCurrentUnit, useProgressRows } from '@/state/selectors';
import { today, useLearner } from '@/state/store';

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function dateLine(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function Home() {
  const focused = useIsFocused();
  const firstName = useLearner((s) => s.firstName);
  const streak = useLearner((s) => s.streak.days);
  const goal = useLearner((s) => s.weeklyGoal);
  const weekDays = useLearner((s) => s.weekDays);
  const assignment = useLearner((s) => s.assignment);
  const skills = useLearner((s) => s.skills);
  const currentWeek = useLearner((s) => s.currentWeek);
  const markGreeted = useLearner((s) => s.markGreeted);
  const rows = useProgressRows();
  const unit = useCurrentUnit();
  const practice = DEMO_LEARNER.todaysPractice;

  // The coach waves on the first visit of the day only.
  const [greet] = useState(() => useLearner.getState().lastGreetedDay !== today());
  useEffect(() => {
    if (greet) markGreeted();
  }, [greet, markGreeted]);

  const focusSkill = unit?.skills[0] ?? 'oars';

  const openAssignment = (it: DemoAssignmentItem) => {
    if (it.kind === 'roleplay') openRoleplay(it.refId, { source: 'assignment' });
    else openDrill(it.refId, { source: 'assignment' });
  };

  return (
    <Screen>
      <Enter style={styles.header}>
        <View style={styles.greeting}>
          <Text variant="caption" color={color.muted}>
            {dateLine()}
          </Text>
          <Text variant="title" accessibilityRole="header" style={styles.hello}>
            {greeting()},{'\n'}
            {firstName}
          </Text>
        </View>
        <Mascot
          pose="wave"
          size={124}
          greet={greet}
          paused={!focused}
          accessibilityLabel="The antelope coach, waving"
          style={styles.mascot}
        />
      </Enter>

      <Enter index={1} style={styles.heroWrap}>
        <TodayHero
          practice={practice}
          onStart={() => openDrill(practice.refId, { minutes: practice.minutes, source: 'today' })}
        />
      </Enter>

      <Enter index={2} style={styles.block}>
        <ThisWeek streak={streak} goal={goal} weekDays={weekDays} />
      </Enter>

      <Enter index={3}>
        <SectionHeader title="From your trainer" />
        <AssignmentCard assignment={assignment} onOpenItem={openAssignment} />
      </Enter>

      <Enter index={4}>
        <SectionHeader
          title="Your progress"
          action={currentWeek > TOTAL_WEEKS ? 'Pathway complete' : `Week ${currentWeek} of ${TOTAL_WEEKS}`}
          onAction={() => router.navigate('/path')}
        />
        <ProgressList rows={rows} />
      </Enter>

      <Enter index={5}>
        <SectionHeader title="More practice" />
        <PracticeTiles
          tiles={[
            {
              key: 'quick',
              title: 'Quick practice',
              detail: '5 min drill',
              icon: <LightningIcon size={24} weight="fill" color={color.primary} />,
              onPress: () => openDrill(pickDrill(focusSkill, skills[focusSkill].level), { minutes: 5, source: 'practice' }),
            },
            {
              key: 'roleplay',
              title: 'Role-play',
              detail: '10–15 min conversation',
              icon: <ChatsCircleIcon size={24} weight="fill" color={color.primary} />,
              onPress: () => openRoleplay(pickScenario(focusSkill).id, { minutes: 12, source: 'practice' }),
            },
            {
              key: 'challenge',
              title: 'Challenge me',
              detail: 'A random scenario',
              icon: <ShuffleIcon size={24} weight="bold" color={color.primary} />,
              onPress: () => router.navigate({ pathname: '/practice', params: { challenge: String(Date.now()) } }),
            },
            {
              key: 'bring',
              title: 'Bring me a challenge',
              detail: 'Practice a real conversation',
              icon: <SparkleIcon size={24} weight="fill" color={color.faint} />,
              soon: true,
            },
          ]}
        />
        <Text variant="caption" color={color.muted} align="center" style={styles.footnote}>
          Focus this week: {getSkill(focusSkill).name}
        </Text>
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2, marginBottom: -8 },
  greeting: { flex: 1, paddingBottom: space[5] },
  hello: { marginTop: 4 },
  mascot: { marginRight: space[2] },
  heroWrap: { zIndex: 1 },
  block: { marginTop: space[5] },
  footnote: { marginTop: space[5] },
});
