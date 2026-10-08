import { getDrill, getSkill, getSkillLevel, type Drill, type DrillFeedback } from '@antelope/core';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { ChoiceTiles } from '@/components/drill/ChoiceTiles';
import { FeedbackPanel, QuietLink } from '@/components/drill/FeedbackPanel';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { CompletionMoment, usePracticeSnapshot } from '@/components/practice-loop/Completion';
import { Composer } from '@/components/practice-loop/Composer';
import { friendlyError, withTimeout, type FriendlyError } from '@/components/practice-loop/errors';
import { Dock, KeyboardColumn, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import { CoachSays, InstructionChip, LearnerBubble, SpeechCard, useBubbleEntrance } from '@/components/practice-loop/Speech';
import { Shimmer } from '@/components/practice-loop/Thinking';
import { ArrowRightIcon, Button, Chip, Hoofprint, Raised, Text, WifiSlashIcon, color, haptic, layout, radius, space } from '@/design';
import { nextDrillId } from '@/data/routes';
import { postJson } from '@/lib/api';
import { Enter, RollingNumber, spring, useReduceMotion } from '@/motion';
import { today, useLearner } from '@/state/store';

/**
 * The daily habit loop. One drill at a time; "One more?" chains through the
 * course activity's drills and then DAILY_DRILL_ORDER. The session counts as
 * one practice (recorded on the first finished rep, so closing early never
 * loses it); "I'm done" shows the streak and weekly ring tick.
 */
export default function DrillScreen() {
  const { id, activityId, minutes } = useLocalSearchParams<{ id: string; activityId?: string; minutes?: string; source?: string }>();
  const [drillId, setDrillId] = useState(id);
  const [done, setDone] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);
  const before = usePracticeSnapshot();
  const recordPractice = useLearner((s) => s.recordPractice);
  const recorded = useRef(false);
  const [day] = useState(() => {
    const s = useLearner.getState().streak;
    return s.lastPracticeDay === today() ? s.days : s.days + 1;
  });
  const mins = Number(minutes) || 5;
  const drill = getDrill(drillId);

  const repDone = (d: Drill) => {
    setDone((xs) => (xs.includes(d.id) ? xs : [...xs, d.id]));
    if (recorded.current) return;
    recorded.current = true;
    recordPractice({ kind: 'drill', skill: d.skill, refId: id, activityId, minutes: mins });
  };

  const oneMore = () => {
    setComplete(false);
    setDrillId(nextDrillId(drillId, done, activityId));
  };

  const header = (
    <SessionHeader
      onClose={() => router.back()}
      center={
        <View style={styles.headCenter}>
          <Text variant="subheading">Day {day}</Text>
          <Text variant="caption" color={color.muted}>
            {mins} minutes of MI practice today
          </Text>
        </View>
      }
      trailing={<RepCounter count={done.length} />}
    />
  );

  if (complete) {
    const n = done.length;
    return (
      <View style={sessionStyles.root}>
        {header}
        <View style={styles.completeBody}>
          <CompletionMoment
            title={n > 1 ? `${n} reps. That’s practice.` : 'One rep, done.'}
            subtitle="Small reps, most days. That’s how this becomes the way you talk."
            before={before}
          >
            <Dock rule={false} style={styles.flush}>
              <Button label="Done" fullWidth onPress={() => router.back()} />
              <Button variant="secondary" label="One more" fullWidth onPress={oneMore} style={styles.second} />
            </Dock>
          </CompletionMoment>
        </View>
      </View>
    );
  }

  if (!drill) {
    return (
      <View style={sessionStyles.root}>
        {header}
        <View style={styles.completeBody}>
          <Text variant="heading" align="center">
            That drill isn’t here yet.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={sessionStyles.root}>
      {header}
      <DrillRep key={drill.id} drill={drill} onRepDone={() => repDone(drill)} onOneMore={oneMore} onDone={() => setComplete(true)} />
    </View>
  );
}

type Phase = 'answer' | 'waiting' | 'feedback' | 'error';

function DrillRep({ drill, onRepDone, onOneMore, onDone }: { drill: Drill; onRepDone: () => void; onOneMore: () => void; onDone: () => void }) {
  const focused = useIsFocused();
  const scroll = useRef<ScrollView>(null);
  const coach = useRef<MascotHandle>(null);
  // choices
  const [selected, setSelected] = useState<number[]>([]);
  const targets = drill.choices?.map((c, i) => (c.isTarget ? i : -1)).filter((i) => i >= 0) ?? [];
  const multi = targets.length > 1;
  const [revealed, setRevealed] = useState(false);
  // free text
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('answer');
  const [feedback, setFeedback] = useState<DrillFeedback | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const inflight = useRef<ReturnType<typeof withTimeout> | null>(null);

  useEffect(() => () => inflight.current?.abort(), []);

  const toEnd = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);

  // ---- choices: local evaluation
  const check = () => {
    if (!selected.length || !drill.choices) return;
    setRevealed(true);
    const hit = selected.length === targets.length && selected.every((i) => targets.includes(i));
    if (hit) {
      haptic.success();
      setTimeout(() => coach.current?.hop(), 380);
    } else haptic.tick();
    onRepDone();
    toEnd();
  };

  // ---- free text: the coach reads it
  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setSubmitted(text);
    setPhase('waiting');
    setError(null);
    toEnd();
    const req = withTimeout(25_000);
    inflight.current = req;
    const started = Date.now();
    try {
      const fb = await postJson<DrillFeedback>('/api/drill/feedback', { drillId: drill.id, response: text }, req.signal);
      // let the listening moment land even when the reply is instant
      const wait = Math.max(0, 1100 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (req.signal.aborted) return;
      setFeedback({ ...fb, possibleResponses: fb.possibleResponses ?? [] });
      setPhase('feedback');
      onRepDone();
      if (fb.hitTarget) haptic.success();
      else haptic.thud();
    } catch (e) {
      if (inflight.current !== req) return;
      setError(friendlyError(e));
      setPhase('error');
      haptic.warn();
    } finally {
      req.clear();
    }
  };

  const editAgain = () => {
    setPhase('answer');
    setSubmitted(null);
    setFeedback(null);
  };

  const tryAgain = () => {
    setDraft('');
    editAgain();
  };

  const caught = selected.filter((i) => targets.includes(i)).length;
  const hit = revealed && caught === targets.length && selected.length === targets.length;
  const partial = revealed && !hit && caught > 0;
  const level = getSkillLevel(drill.level);

  return (
    <KeyboardColumn>
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={[sessionStyles.scroll, styles.content, phase === 'feedback' && styles.contentUnderPanel]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={sessionStyles.column}>
          <Enter style={styles.chips}>
            <Chip label={getSkill(drill.skill).name} tone="soft" />
            <Chip label={`Level ${drill.level} · ${level.name}`} tone="neutral" />
          </Enter>

          <View style={styles.block}>
            <SpeechCard context={drill.context} speaker={drill.speaker} seed={`${drill.id}:${drill.speaker}`} line={drill.prompt} />
          </View>

          <Enter delay={560} style={styles.block}>
            <InstructionChip text={drill.instruction} />
          </Enter>

          {drill.choices ? (
            <View style={styles.block}>
              {multi ? (
                <Text variant="caption" color={color.muted} style={styles.multi}>
                  More than one fits. Pick all that apply.
                </Text>
              ) : null}
              <ChoiceTiles
                choices={drill.choices}
                selected={selected}
                revealed={revealed}
                multi={multi}
                onSelect={(i) => {
                  if (revealed) return;
                  setSelected((xs) => (multi ? (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]) : [i]));
                }}
              />
            </View>
          ) : null}

          {revealed ? (
            <Enter delay={420} style={styles.block}>
              <CoachSays ref={coach} pose="head" size={60} paused={!focused}>
                <Text variant="body">
                  {hit
                    ? 'Nice ear. Spotting it is the first step to using it on purpose.'
                    : partial
                      ? 'You caught part of it. Read the ones you didn’t pick; that’s where the learning is.'
                      : 'Not the one the drill was after, and that’s useful to notice. Read why each one lands the way it does.'}
                </Text>
              </CoachSays>
            </Enter>
          ) : null}

          {submitted ? <Submitted text={submitted} /> : null}

          {phase === 'waiting' ? (
            <Enter delay={250} style={[styles.block, styles.listening]}>
              <Mascot pose="head" mood="listening" size={58} paused={!focused} accessibilityLabel="The antelope coach, listening" />
              <View style={styles.listeningCopy}>
                <Text variant="label" color={color.muted}>
                  Listening to how that lands…
                </Text>
                <Shimmer width={150} />
              </View>
            </Enter>
          ) : null}

          {phase === 'error' && error ? (
            <Enter style={styles.block}>
              <Raised tone="surface" depth={4} contentStyle={styles.errorFace}>
                <View style={styles.errorIcon}>
                  <WifiSlashIcon size={22} weight="bold" color={color.primary} />
                </View>
                <View style={styles.flex}>
                  <Text variant="subheading">{error.title}</Text>
                  <Text variant="body" color={color.muted}>
                    {error.detail} Your response is saved.
                  </Text>
                </View>
              </Raised>
            </Enter>
          ) : null}
        </View>
      </ScrollView>

      {drill.choices ? (
        <Dock>
          {revealed ? (
            <>
              <Button label="One more" fullWidth onPress={onOneMore} icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />} />
              <QuietLink label="I’m done" onPress={onDone} />
            </>
          ) : (
            <Button label="Check" fullWidth disabled={!selected.length} onPress={check} />
          )}
        </Dock>
      ) : phase === 'answer' ? (
        <Dock>
          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={submit}
            placeholder="Type what you’d say…"
            accessibilityLabel={`Your response to: ${drill.prompt}`}
          />
        </Dock>
      ) : phase === 'error' ? (
        <Dock>
          <Button label="Try again" fullWidth onPress={submit} />
          <QuietLink label="Edit my response" onPress={editAgain} />
        </Dock>
      ) : null}

      {phase === 'feedback' && feedback ? (
        <FeedbackPanel
          feedback={feedback}
          paused={!focused}
          actions={
            <>
              <Button label="One more" fullWidth onPress={onOneMore} icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />} />
              <View style={styles.linkRow}>
                <QuietLink label="Try this one again" onPress={tryAgain} />
                <View style={styles.linkDot} />
                <QuietLink label="I’m done" onPress={onDone} />
              </View>
            </>
          }
        />
      ) : null}
    </KeyboardColumn>
  );
}

function Submitted({ text }: { text: string }) {
  const enter = useBubbleEntrance('right');
  return (
    <Animated.View style={[styles.block, enter]}>
      <Text variant="caption" color={color.muted} align="right" style={styles.you}>
        You
      </Text>
      <LearnerBubble text={text} />
    </Animated.View>
  );
}

/** Reps this session: a hoofprint and a rolling count that pops when it ticks. */
function RepCounter({ count }: { count: number }) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(1);
  useEffect(() => {
    if (count > 0 && !reduce) pop.value = withSequence(withSpring(1.18, spring.snappy), withSpring(1, spring.bouncy));
  }, [count, reduce, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.View style={[styles.reps, count > 0 && styles.repsOn, style]} accessible accessibilityLabel={`${count} ${count === 1 ? 'rep' : 'reps'} this session`}>
      <Hoofprint size={16} tint={count > 0 ? color.gold : color.faint} rotate={-12} />
      <RollingNumber value={count} variant="label" color={count > 0 ? '#8A5A0B' : color.muted} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headCenter: { alignItems: 'center' },
  content: { paddingTop: space[2], paddingBottom: space[6] },
  contentUnderPanel: { paddingBottom: 520 },
  chips: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
  block: { marginTop: space[5] },
  you: { marginBottom: 4, marginRight: 4 },
  listening: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  listeningCopy: { gap: space[2] },
  errorFace: { flexDirection: 'row', gap: space[3], padding: space[4], alignItems: 'flex-start' },
  errorIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[3] },
  linkDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.line },
  reps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: color.soft,
  },
  repsOn: { backgroundColor: color.goldTint },
  multi: { marginBottom: space[3] },
  completeBody: { flex: 1, paddingHorizontal: layout.gutter, justifyContent: 'center' },
  flush: { paddingHorizontal: 0 },
  second: { marginTop: space[3] },
});
