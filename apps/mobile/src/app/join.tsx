import type { PathwayId } from '@antelope/core';
import { Redirect, router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { CodeInput, type CodeState } from '@/components/account/CodeInput';
import { FlowHeader, Notice, flowStyles } from '@/components/account/FlowChrome';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { Avatar, Button, CheckIcon, Raised, Text, color, haptic, space } from '@/design';
import { Burst, Enter, FADE_MS, spring, useFades, useReduceMotion, type BurstHandle } from '@/motion';
import { track } from '@/lib/analytics';
import { emitFlowClosed } from '@/lib/flowEvents';
import { joinCohort } from '@/sync/cloud';
import { refresh } from '@/sync/engine';
import { TrackCard } from '@/components/track/TrackCard';
import { getPathway, trackName } from '@/data/pathways';
import { personSeed, useAccount } from '@/state/account';
import { useLearner } from '@/state/store';

/**
 * Join a cohort with the trainer's code. Codes are always "MIL-" + 4 characters,
 * so the prefix is fixed and the learner types (or pastes) the rest; input is
 * upper-cased as it's typed. A complete code joins straight away.
 */
export default function Join() {
  const status = useAccount((s) => s.status);
  const focused = useIsFocused();
  const [code, setCode] = useState('');
  const [state, setState] = useState<CodeState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ id: string; name: string; pathwayId: PathwayId } | null>(null);
  const coach = useRef<MascotHandle>(null);
  useEffect(() => () => emitFlowClosed('join'), []);

  if (status === 'guest') return <Redirect href={{ pathname: '/sign-in', params: { reason: 'cohort' } }} />;

  const submit = async (c = code) => {
    if (c.length < 4 || state === 'busy' || state === 'success') return;
    setState('busy');
    setError(null);
    const res = await joinCohort(c);
    if (!res.ok) {
      setState('error');
      setError(
        res.reason === 'not-found'
          ? 'That code doesn’t match an active cohort. Check it with your trainer.'
          : res.reason === 'offline'
            ? 'You might be offline. Check your connection, then try again.'
            : 'Something went wrong on our side. Try again in a moment.',
      );
      return;
    }
    setState('success');
    track('cohort_joined', { cohort_id: res.cohort.id });
    // let the cells fill before the card takes over
    setTimeout(() => setJoined(res.cohort), 420);
    void refresh();
  };

  return (
    <View style={flowStyles.root}>
      <FlowHeader onClose={() => router.back()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} bounces={false}>
        <View style={flowStyles.body}>
          {joined ? (
            <Joined cohort={joined} onDone={() => router.back()} />
          ) : (
            <View>
              <Enter style={styles.coachRow}>
                <Mascot
                  ref={coach}
                  pose="head"
                  mood={state === 'busy' ? 'thinking' : 'listening'}
                  size={76}
                  paused={!focused}
                  accessibilityLabel="The antelope coach"
                />
              </Enter>
              <Enter index={1}>
                <Text variant="title" accessibilityRole="header">
                  Join your cohort
                </Text>
                <Text variant="body" color={color.muted} style={styles.lede}>
                  Enter the code your trainer shared with you.
                </Text>
              </Enter>
              <Enter index={2}>
                <CodeInput
                  length={4}
                  charset="alnum"
                  prefix="MIL"
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (state === 'error') {
                      setState('idle');
                      setError(null);
                    }
                  }}
                  onComplete={(v) => submit(v)}
                  state={state}
                  autoFocus
                  accessibilityLabel="Cohort code, 4 characters after MIL"
                  style={styles.code}
                />
                <Notice text={error} />
              </Enter>
              <Enter index={3} style={styles.actions}>
                <Button label={state === 'busy' ? 'Joining…' : 'Join'} fullWidth disabled={code.length < 4 || state === 'busy'} onPress={() => submit()} />
              </Enter>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * You're in: the ochre seal drops and pops with a burst and the success haptic on
 * the same frame, then the cohort card rises with the trainer and what's waiting.
 */
function Joined({ cohort, onDone }: { cohort: { id: string; name: string; pathwayId: PathwayId }; onDone: () => void }) {
  // the cohort runs another track than the one you're on: offer to switch (decided once, on arrival)
  const [offer] = useState(() => useLearner.getState().activePathwayId !== cohort.pathwayId);
  const active = useLearner((s) => s.activePathwayId);
  const reduce = useReduceMotion();
  const burst = useRef<BurstHandle>(null);
  const seal = useSharedValue(0);
  const fades = useFades();
  const info = useAccount((s) => s.cohorts.find((c) => c.id === cohort.id));
  const all = useAccount((s) => s.assignments);
  const assignments = all.filter((a) => a.cohortId === cohort.id);

  useEffect(() => {
    if (reduce) {
      seal.value = withTiming(1, { duration: FADE_MS });
      haptic.success();
      return;
    }
    seal.value = withSequence(withSpring(1.18, spring.snappy), withSpring(1, spring.bouncy));
    const t = setTimeout(() => {
      burst.current?.fire();
      haptic.success();
    }, 140);
    return () => clearTimeout(t);
  }, [reduce, seal]);

  const sealStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, seal.value * 2),
    transform: reduce ? [] : [{ scale: seal.value }, { rotate: `${(1 - Math.min(1, seal.value)) * -30}deg` }],
  }));
  const next = assignments[0];

  return (
    <View style={styles.joined} accessibilityLiveRegion="polite">
      <View style={styles.sealWrap}>
        <Animated.View style={[styles.seal, sealStyle]}>
          <CheckIcon size={38} weight="bold" color={color.navy} />
        </Animated.View>
        <Burst ref={burst} count={18} power={0.85} duration={700} spread={120} />
      </View>
      <Enter index={2} delay={120}>
        <Text variant="title" align="center" accessibilityRole="header">
          You’re in
        </Text>
        <Text variant="body" color={color.muted} align="center" style={styles.lede}>
          Your trainer’s assignments now show up on Home.
        </Text>
      </Enter>
      <Enter index={3} delay={120} style={styles.cardWrap}>
        <Raised contentStyle={styles.card}>
          <Avatar seed={info ? personSeed(info.trainerName) : cohort.id} size={48} accessibilityLabel={info?.trainerName ?? 'Your trainer'} />
          <View style={styles.flex}>
            <Text variant="subheading">{cohort.name}</Text>
            <Animated.View key={info?.trainerName ?? 'loading'} entering={fades.entering}>
              <Text variant="caption" color={color.muted}>
                {info ? `With ${info.trainerName}` : 'Loading your trainer…'}
                {next ? ` · ${next.title} is waiting` : ''}
              </Text>
            </Animated.View>
          </View>
        </Raised>
      </Enter>
      {offer ? (
        <Enter index={4} delay={120} style={styles.offer}>
          <Text variant="subheading">This cohort practices {getPathway(cohort.pathwayId).title}</Text>
          <Text variant="caption" color={color.muted} style={styles.offerLede}>
            Switch so Home and your path follow your cohort. {getPathway(active).title} keeps its progress, and you can switch back in Me.
          </Text>
          <TrackCard id={cohort.pathwayId} compact selected onSelect={() => {}} style={styles.offerCard} />
          <View style={styles.offerActions}>
            <Button
              label={`Switch to ${trackName(cohort.pathwayId)}`}
              fullWidth
              onPress={() => {
                haptic.success();
                useLearner.getState().choosePathway(cohort.pathwayId, 'cohort');
                onDone();
              }}
            />
            <Button variant="secondary" label={`Keep ${trackName(active)}`} fullWidth onPress={onDone} />
          </View>
        </Enter>
      ) : (
        <Enter index={4} delay={120} style={styles.actions}>
          <Button label="Done" fullWidth onPress={onDone} />
        </Enter>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space[10] },
  coachRow: {
    alignItems: 'flex-start',
    marginTop: space[2],
    marginBottom: space[3],
  },
  lede: { marginTop: space[2] },
  code: { marginTop: space[6], alignSelf: 'stretch' },
  actions: { marginTop: space[6] },
  flex: { flex: 1 },
  joined: { paddingTop: space[8] },
  sealWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 104,
    marginBottom: space[4],
  },
  seal: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: color.gold,
    borderBottomWidth: 6,
    borderBottomColor: color.goldShadow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrap: { marginTop: space[6] },
  offer: { marginTop: space[7] },
  offerLede: { marginTop: space[1] },
  offerCard: { marginTop: space[4] },
  offerActions: { marginTop: space[5], gap: space[3] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
  },
});
