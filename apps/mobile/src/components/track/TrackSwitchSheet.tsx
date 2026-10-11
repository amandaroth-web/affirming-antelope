import type { PathwayId } from '@antelope/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { getPathway, PATHWAY_IDS, trackName } from '@/data/pathways';
import { BottomSheet, Button, Text, color, haptic, space } from '@/design';
import { useTickSwap } from '@/motion';
import { weekLabel } from '@/state/selectors';
import { progressOf, useLearner, type PathwayChoiceSource } from '@/state/store';
import { TrackCard } from './TrackCard';

/**
 * Switch tracks, with a confirm. The two track cards sit in the sheet with the one
 * you're on marked; the other is preselected (or the cohort's, when a cohort asks).
 * The primary action names where you're going and the line above it says what stays
 * put ("MI for Clinicians stays at week 3 of 8"), so the switch never feels like a reset.
 * The keep-going choice is secondary, never red.
 */
export function TrackSwitchSheet({
  open,
  onClose,
  source,
  suggest,
  title,
  lede,
  onSwitched,
}: {
  open: boolean;
  onClose: () => void;
  source: PathwayChoiceSource;
  /** Preselect this track (a cohort's). Defaults to the one you're not on. */
  suggest?: PathwayId;
  title?: string;
  lede?: string;
  onSwitched?: (id: PathwayId) => void;
}) {
  const active = useLearner((s) => s.activePathwayId);
  const progress = useLearner((s) => s.progress);
  const other = PATHWAY_IDS.find((id) => id !== active) ?? active;
  const [choice, setChoice] = useState<PathwayId>(suggest ?? other);
  const tick = useTickSwap();
  // each opening starts from the suggestion (reset while rendering, not in an effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setChoice(suggest ?? other);
  }

  const here = getPathway(active);
  const there = getPathway(choice);
  const hereAt = progressOf({ progress, activePathwayId: active }).currentWeek;
  const thereAt = progress[choice]?.currentWeek;
  const switching = choice !== active;
  const at = (p: typeof here, w: number) => (w > p.units.length ? 'complete' : `at ${weekLabel(p, w).toLowerCase()}`);
  const keepLine = `${here.title} stays ${at(here, hereAt)}.`;
  const goLine = thereAt && thereAt > 1 ? `${there.title} picks up ${at(there, thereAt)}.` : `${there.title} starts at week 1.`;

  const confirm = () => {
    if (!switching) return onClose();
    haptic.success();
    useLearner.getState().choosePathway(choice, source);
    onClose();
    onSwitched?.(choice);
  };

  return (
    <BottomSheet open={open} onClose={onClose} accessibilityLabel={title ?? 'Switch your track'}>
      <Text variant="heading" accessibilityRole="header">
        {title ?? 'Switch your track?'}
      </Text>
      <Text variant="body" color={color.muted} style={styles.lede}>
        {lede ?? 'Each track keeps its own progress. Your streak and skill levels come with you.'}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.cards}>
        {PATHWAY_IDS.map((id) => (
          <TrackCard key={id} id={id} compact current={id === active} selected={choice === id} onSelect={setChoice} />
        ))}
      </View>
      <View style={styles.noteBox}>
        <Animated.View key={`${active}-${choice}`} entering={tick.entering} exiting={tick.exiting}>
          <Text variant="caption" color={color.muted} align="center">
            {switching ? `${keepLine} ${goLine}` : `You’re on ${here.title}, ${hereAt > here.units.length ? 'complete' : weekLabel(here, hereAt).toLowerCase()}.`}
          </Text>
        </Animated.View>
      </View>
      <View style={styles.actions}>
        <Button label={switching ? `Switch to ${trackName(choice)}` : 'Done'} fullWidth onPress={confirm} />
        {switching ? <Button variant="secondary" label={`Keep ${trackName(active)}`} fullWidth onPress={onClose} /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  lede: { marginTop: space[2] },
  cards: { marginTop: space[5], gap: space[3] },
  noteBox: { marginTop: space[4], minHeight: 34, justifyContent: 'center' },
  actions: { marginTop: space[4], gap: space[3] },
});
