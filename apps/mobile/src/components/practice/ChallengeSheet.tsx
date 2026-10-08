import { SCENARIOS, getSkill, type ScenarioSpec } from '@antelope/core';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ArrowRightIcon, Avatar, BottomSheet, Button, Chip, Text, color, haptic, radius, space } from '@/design';
import { Enter, spring, useReduceMotion } from '@/motion';

const ROW = 84;
const LOOPS = 4;
const DIFF: Record<ScenarioSpec['difficulty'], string> = { intro: 'Intro', intermediate: 'Intermediate', advanced: 'Advanced' };

/**
 * "Challenge me": a slot-machine shuffle through the scenario cast. The strip
 * decelerates, ticks a haptic as each person passes the window, overshoots a
 * hair and settles on the pick.
 */
export function ChallengeSheet({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (s: ScenarioSpec) => void;
}) {
  const reduce = useReduceMotion();
  const [pick, setPick] = useState<number | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const y = useSharedValue(0);
  const n = SCENARIOS.length;
  const strip = Array.from({ length: n * (LOOPS + 1) }, (_, i) => SCENARIOS[i % n]);

  useEffect(() => {
    if (!open) return;
    setPick(null);
    const chosen = Math.floor(Math.random() * n);
    const target = (LOOPS * n + chosen) * ROW;
    const land = () => {
      setPick(chosen);
      haptic.success();
    };
    y.value = 0;
    if (reduce) {
      y.value = target;
      land();
      return;
    }
    y.value = withSequence(
      withTiming(target + 10, { duration: 1500, easing: Easing.bezier(0.15, 0.6, 0.2, 1) }),
      withSpring(target, spring.release, (f) => {
        if (f) scheduleOnRN(land);
      }),
    );
  }, [open, spinKey, n, reduce, y]);

  useAnimatedReaction(
    () => Math.round(y.value / ROW),
    (i, prev) => {
      if (prev !== null && i !== prev) scheduleOnRN(haptic.tick);
    },
  );

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -y.value }] }));
  const s = pick !== null ? SCENARIOS[pick] : null;

  return (
    <BottomSheet open={open} onClose={onClose} accessibilityLabel="Challenge me">
      <Text variant="overline" color={color.primaryShadow}>
        Challenge me
      </Text>
      <Text variant="title" style={styles.title}>
        {s ? 'Here’s your conversation' : 'Finding someone to talk to…'}
      </Text>

      <View style={styles.window} accessibilityElementsHidden={!s}>
        <Animated.View style={stripStyle}>
          {strip.map((sc, i) => (
            <View key={i} style={styles.row}>
              <Avatar seed={sc.persona.avatarSeed} size={56} />
              <View style={styles.rowCopy}>
                <Text variant="subheading" numberOfLines={1}>
                  {sc.persona.name}
                </Text>
                <Text variant="caption" color={color.muted} numberOfLines={1}>
                  {sc.persona.role}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.details}>
        {s ? (
          <Enter key={s.id}>
            <Text variant="heading">{s.title}</Text>
            <View style={styles.chips}>
              <Chip label={s.context} tone="soft" />
              <Chip label={getSkill(s.primaryChallenge).name} tone="soft" />
              <Chip label={DIFF[s.difficulty]} tone="neutral" />
            </View>
            <Text variant="body" color={color.muted} numberOfLines={3} style={styles.brief}>
              {s.learnerGoal}
            </Text>
          </Enter>
        ) : null}
      </View>

      <Button
        label="Start"
        disabled={!s}
        onPress={() => s && onStart(s)}
        fullWidth
        icon={<ArrowRightIcon size={20} weight="bold" color={s ? color.white : color.faint} />}
        accessibilityLabel={s ? `Start role-play with ${s.persona.name}` : 'Start'}
      />
      <Button
        variant="secondary"
        label="Shuffle again"
        disabled={!s}
        onPress={() => setSpinKey((k) => k + 1)}
        fullWidth
        style={styles.again}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space[1], marginBottom: space[4] },
  window: {
    height: ROW,
    overflow: 'hidden',
    borderRadius: radius.surface,
    borderWidth: 2,
    borderColor: color.line,
    backgroundColor: color.soft,
  },
  row: { height: ROW, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4] },
  rowCopy: { flex: 1 },
  details: { minHeight: 150, paddingTop: space[4] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] },
  brief: { marginTop: space[3] },
  again: { marginTop: space[3] },
});
