import { SKILLS, getSkill, type SkillId } from '@antelope/core';
import { useLocalSearchParams } from 'expo-router';
import { createRef, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ChallengeSheet } from '@/components/practice/ChallengeSheet';
import { SkillTile } from '@/components/practice/SkillTile';
import {
  ArrowRightIcon,
  Avatar,
  Button,
  CaretRightIcon,
  PressableSurface,
  Screen,
  SegmentedControl,
  ShuffleIcon,
  Text,
  color,
  layout,
  radius,
  space,
  type as typeScale,
} from '@/design';
import { openDrill, openRoleplay, pickDrill, pickScenario } from '@/data/routes';
import { Enter } from '@/motion';
import { launchFrom } from '@/motion/launch';
import { useCurrentUnit } from '@/state/selectors';
import { useLearner } from '@/state/store';
import { SCENARIOS } from '@antelope/core';

type Minutes = 5 | 10 | 15;

export default function Practice() {
  const insets = useSafeAreaInsets();
  const skills = useLearner((s) => s.skills);
  const unit = useCurrentUnit();
  const [minutes, setMinutes] = useState<Minutes>(5);
  const [skill, setSkill] = useState<SkillId>(unit?.skills[0] ?? 'oars');
  const [challenge, setChallenge] = useState(false);
  const { challenge: challengeParam } = useLocalSearchParams<{ challenge?: string }>();

  // Home's "Challenge me" tile lands here and opens the shuffle.
  useEffect(() => {
    if (challengeParam) setChallenge(true);
  }, [challengeParam]);

  const isDrill = minutes === 5;
  const tiles = useMemo(() => Object.fromEntries(SKILLS.map((s) => [s.id, { card: createRef<View>(), title: createRef<View>() }])), []);
  const startRef = useRef<View>(null);
  // the session opens out of the selected skill tile; for a role-play, START also becomes the brief's START
  const start = () => {
    const name = getSkill(skill).name;
    launchFrom(
      {
        container: tiles[skill].card,
        depth: 4,
        face: color.soft,
        radius: radius.surface,
        title: { ref: tiles[skill].title, text: name, style: { ...typeScale.subheading, color: color.primaryShadow } },
        cta: isDrill ? undefined : { ref: startRef, face: color.primary, radius: radius.md, label: 'START', labelStyle: { ...typeScale.button, color: color.white } },
      },
      () => {
        if (isDrill) openDrill(pickDrill(skill, skills[skill].level), { minutes, source: 'practice' });
        else openRoleplay(pickScenario(skill).id, { minutes, source: 'practice' });
      },
    );
  };

  return (
    <View style={styles.root}>
      <Screen contentContainerStyle={{ paddingBottom: insets.bottom + layout.tabBarHeight + 120 }}>
        <Enter>
          <Text variant="title" accessibilityRole="header">
            Open practice
          </Text>
          <Text variant="body" color={color.muted} style={styles.lede}>
            Pick your time and a skill. We’ll find the right rep.
          </Text>
        </Enter>

        <Enter index={1} style={styles.block}>
          <Text variant="subheading" style={styles.q}>
            I have…
          </Text>
          <SegmentedControl<Minutes>
            accessibilityLabel="How much time do you have?"
            value={minutes}
            onChange={setMinutes}
            segments={[
              { value: 5, label: '5 min', hint: 'Drill' },
              { value: 10, label: '10 min', hint: 'Role-play' },
              { value: 15, label: '15 min', hint: 'Role-play' },
            ]}
          />
        </Enter>

        <Enter index={2}>
          <PressableSurface
            tone="navy"
            depth={5}
            radius={radius.surface}
            onPress={() => setChallenge(true)}
            accessibilityLabel="Challenge me: a random role-play scenario"
            style={styles.challenge}
            contentStyle={styles.challengeFace}
          >
            <View style={styles.shuffle}>
              <ShuffleIcon size={24} weight="bold" color={color.navy} />
            </View>
            <View style={styles.challengeCopy}>
              <Text variant="subheading" color={color.white}>
                Challenge me
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.75)">
                A random scenario, any skill
              </Text>
            </View>
            <View style={styles.cast}>
              {SCENARIOS.slice(0, 3).map((s, i) => (
                <View key={s.id} style={[styles.castItem, { marginLeft: i ? -14 : 0, zIndex: 3 - i }]}>
                  <Avatar seed={s.persona.avatarSeed} size={34} />
                </View>
              ))}
            </View>
            <CaretRightIcon size={18} weight="bold" color="rgba(255,255,255,0.7)" />
          </PressableSurface>
        </Enter>

        <Enter index={3}>
          <SectionHeader title="What do you want to practice?" />
          <View style={styles.grid} accessibilityRole="radiogroup">
            {SKILLS.map((s) => (
              <SkillTile key={s.id} skill={s} progress={skills[s.id]} selected={s.id === skill} onPress={() => setSkill(s.id)} heroRefs={tiles[s.id]} />
            ))}
          </View>
        </Enter>
      </Screen>

      <View style={[styles.dock, { bottom: insets.bottom + layout.tabBarHeight }]}>
        <View style={styles.dockInner}>
          <View style={styles.dockCopy}>
            <Text variant="caption" color={color.muted}>
              {isDrill ? '5-minute drill' : `${minutes}-minute role-play`}
            </Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {getSkill(skill).name}
            </Text>
          </View>
          <View ref={startRef} collapsable={false}>
          <Button
            label="Start"
            onPress={start}
            icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />}
            accessibilityLabel={`Start a ${minutes}-minute ${isDrill ? 'drill' : 'role-play'} on ${getSkill(skill).name}`}
          />
          </View>
        </View>
      </View>

      <ChallengeSheet
        open={challenge}
        onClose={() => setChallenge(false)}
        onStart={(s) => {
          setChallenge(false);
          setTimeout(() => openRoleplay(s.id, { minutes: 12, source: 'challenge' }), 180);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.white },
  lede: { marginTop: space[1] },
  block: { marginTop: space[6] },
  q: { marginBottom: space[3] },
  challenge: { marginTop: space[5] },
  challengeFace: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  shuffle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: color.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeCopy: { flex: 1 },
  cast: { flexDirection: 'row' },
  castItem: { borderRadius: 19, borderWidth: 2, borderColor: color.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: color.white,
    borderTopWidth: 2,
    borderTopColor: color.line,
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
    paddingBottom: space[3],
  },
  dockInner: { flexDirection: 'row', alignItems: 'center', gap: space[4], maxWidth: layout.maxWidth, width: '100%', alignSelf: 'center' },
  dockCopy: { flex: 1 },
});
