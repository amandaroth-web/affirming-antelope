import { getSkill, type DemoAssignmentItem } from '@antelope/core';
import { DEMO_LEARNER } from '@antelope/core';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { SectionHeader } from '@/components/common/SectionHeader';
import { AssignmentCard } from '@/components/home/AssignmentCard';
import { PracticeTiles } from '@/components/home/PracticeTiles';
import { useSeen } from '@/components/home/motion';
import { ProgressList } from '@/components/home/ProgressList';
import { ThisWeek } from '@/components/home/ThisWeek';
import { TodayHero } from '@/components/home/TodayHero';
import { Mascot } from '@/components/mascot';
import { ChatsCircleIcon, Hoofprint, LightningIcon, Screen, ShuffleIcon, SparkleIcon, Text, border, color, layout, space } from '@/design';
import { openDrill, openRoleplay, pickDrill, pickScenario } from '@/data/routes';
import { Enter, FADE_MS, RollingNumber, useListLayout, useReduceMotion } from '@/motion';
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
  const liveRows = useProgressRows();
  const unit = useCurrentUnit();
  const reduce = useReduceMotion();
  const listLayout = useListLayout();
  const practice = DEMO_LEARNER.todaysPractice;

  // The coach waves on the first visit of the day only.
  const [greet] = useState(() => useLearner.getState().lastGreetedDay !== today());
  useEffect(() => {
    if (greet) markGreeted();
  }, [greet, markGreeted]);

  const focusSkill = unit?.skills[0] ?? 'oars';

  // Home keeps updating under the practice screens. Hold what it shows until
  // it's back in view, so each change animates once, where it can be seen.
  const seen = useSeen({ streak, goal, weekDays, assignment, skills, rows: liveRows, currentWeek }, focused);

  // Header handoff: the big greeting leaves under a compact title bar.
  const scrollY = useSharedValue(0);
  const greetH = useSharedValue(GREET_H);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  // the waving coach rests once it has scrolled away
  const [coachAway, setCoachAway] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > greetH.value + 140,
    (away, was) => {
      if (away !== was) scheduleOnRN(setCoachAway, away);
    },
  );
  const greetStyle = useAnimatedStyle(() => {
    if (reduce) return {};
    const y = scrollY.value;
    const h = greetH.value;
    return {
      opacity: interpolate(y, [0, h * 0.6], [1, 0], Extrapolation.CLAMP),
      transform: [
        // parallax: it drifts up a little slower than the page
        { translateY: interpolate(y, [0, h * 1.2], [0, h * 0.3], Extrapolation.CLAMP) },
        { scale: interpolate(y, [0, h * 0.75], [1, 0.94], Extrapolation.CLAMP) },
      ],
    };
  });

  const openAssignment = (it: DemoAssignmentItem) => {
    if (it.kind === 'roleplay') openRoleplay(it.refId, { source: 'assignment' });
    else openDrill(it.refId, { source: 'assignment' });
  };

  return (
    <Screen
      scrollHandler={onScroll}
      overlay={<CompactBar title={`${greeting()}, ${firstName}`} streak={seen.streak} scrollY={scrollY} greetH={greetH} reduce={reduce} />}
    >
      <Enter style={styles.header}>
        <Animated.View
          style={[styles.greeting, greetStyle]}
          onLayout={(e) => {
            greetH.value = Math.max(60, e.nativeEvent.layout.height);
          }}
        >
          <Text variant="caption" color={color.muted}>
            {dateLine()}
          </Text>
          <Text variant="title" accessibilityRole="header" style={styles.hello}>
            {greeting()},{'\n'}
            {firstName}
          </Text>
        </Animated.View>
        <Mascot
          pose="wave"
          size={124}
          greet={greet}
          paused={!focused || coachAway}
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

      <Animated.View layout={listLayout}>
        <Enter index={2} style={styles.block}>
          <ThisWeek streak={seen.streak} goal={seen.goal} weekDays={seen.weekDays} />
        </Enter>
      </Animated.View>

      <Animated.View layout={listLayout}>
        <Enter index={3}>
          <SectionHeader title="From your trainer" />
          <AssignmentCard assignment={seen.assignment} onOpenItem={openAssignment} />
        </Enter>
      </Animated.View>

      <Animated.View layout={listLayout}>
        <Enter index={4}>
          <SectionHeader
            title="Your progress"
            action={seen.currentWeek > TOTAL_WEEKS ? 'Pathway complete' : `Week ${seen.currentWeek} of ${TOTAL_WEEKS}`}
            onAction={() => router.navigate('/path')}
          />
          <ProgressList rows={seen.rows} skills={seen.skills} />
        </Enter>
      </Animated.View>

      <Animated.View layout={listLayout}>
        <Enter index={5}>
          <SectionHeader title="More practice" action={`Focus this week: ${getSkill(focusSkill).name}`} />
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
        </Enter>
      </Animated.View>
    </Screen>
  );
}

/** Fallback greeting height until it's measured (date + two title lines + padding). */
const GREET_H = 105;
const BAR_H = 44;

/**
 * Compact sticky title. It takes over as the big greeting passes under it:
 * the greeting is gone by 60% of its height, this fades and rises in over
 * 35-70%, the white face over 20-60%, and the 2pt rule once it's fully docked.
 * Reduced motion: the bar cross-fades in at the halfway point, nothing travels.
 */
function CompactBar({
  title,
  streak,
  scrollY,
  greetH,
  reduce,
}: {
  title: string;
  streak: number;
  scrollY: SharedValue<number>;
  greetH: SharedValue<number>;
  reduce: boolean;
}) {
  const insets = useSafeAreaInsets();
  const docked = useSharedValue(0);
  useAnimatedReaction(
    () => scrollY.value > greetH.value * 0.5,
    (on, was) => {
      if (reduce && on !== was) docked.value = withTiming(on ? 1 : 0, { duration: FADE_MS });
    },
    [reduce],
  );
  const face = useAnimatedStyle(() => {
    if (reduce) return { opacity: docked.value };
    const h = greetH.value;
    return { opacity: interpolate(scrollY.value, [h * 0.2, h * 0.6], [0, 1], Extrapolation.CLAMP) };
  });
  const rule = useAnimatedStyle(() => {
    if (reduce) return { opacity: docked.value };
    const h = greetH.value;
    return { opacity: interpolate(scrollY.value, [h * 0.6, h * 0.95], [0, 1], Extrapolation.CLAMP) };
  });
  const content = useAnimatedStyle(() => {
    if (reduce) return { opacity: docked.value };
    const h = greetH.value;
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [h * 0.35, h * 0.7], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(y, [h * 0.35, h * 0.7], [8, 0], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View
      pointerEvents="none"
      style={[styles.bar, { height: insets.top + BAR_H }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.barFace, face]} />
      <Animated.View style={[styles.barRule, rule]} />
      <Animated.View style={[styles.barRow, { marginTop: insets.top }, content]}>
        <Text variant="subheading" numberOfLines={1} style={styles.barTitle}>
          {title}
        </Text>
        <View style={styles.barStreak}>
          <Hoofprint size={18} tint={color.gold} rotate={-12} />
          <RollingNumber value={streak} from={streak} variant="subheading" />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  barFace: { backgroundColor: color.white },
  barRule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: border, backgroundColor: color.line },
  barRow: {
    height: BAR_H,
    width: '100%',
    maxWidth: layout.maxWidth + layout.gutter * 2,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  barTitle: { flex: 1 },
  barStreak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2, marginBottom: -8 },
  greeting: { flex: 1, paddingBottom: space[5], transformOrigin: 'left top' },
  hello: { marginTop: 4 },
  mascot: { marginRight: space[2] },
  heroWrap: { zIndex: 1 },
  block: { marginTop: space[5] },
});
