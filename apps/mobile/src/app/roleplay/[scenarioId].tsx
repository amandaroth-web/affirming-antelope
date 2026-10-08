import { SCENARIOS, getScenario, type Debrief as DebriefData, type MoveTallies, type ScenarioSpec, type SelfReflection, type Turn } from '@antelope/core';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { usePracticeSnapshot } from '@/components/practice-loop/Completion';
import { friendlyError, withTimeout, type FriendlyError } from '@/components/practice-loop/errors';
import { Dock, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import { CoachThinking } from '@/components/practice-loop/Thinking';
import { Brief } from '@/components/roleplay/Brief';
import { Conversation } from '@/components/roleplay/Conversation';
import { Debrief, type NextChoice } from '@/components/roleplay/Debrief';
import { Reflection } from '@/components/roleplay/Reflection';
import { Button, Raised, Text, WifiSlashIcon, color, haptic, layout, space } from '@/design';
import { openDrill, openRoleplay, pickDrill, type PracticeSource } from '@/data/routes';
import { postJson } from '@/lib/api';
import { FADE_MS, spring, useReduceMotion } from '@/motion';
import { useLearner } from '@/state/store';

type Params = { scenarioId: string; activityId?: string; minutes?: string; source?: string };

export default function RoleplayScreen() {
  const params = useLocalSearchParams<Params>();
  const scenario = getScenario(params.scenarioId);
  // a fresh flow per scenario (e.g. after "Try a harder scenario" replaces this screen)
  if (!scenario) return <Missing />;
  return <RoleplayFlow key={scenario.id} scenario={scenario} params={params} />;
}

type Phase = 'brief' | 'chat' | 'reflect' | 'thinking' | 'debrief';

const THINKING_LINES = [
  'Reading back through your reflections…',
  'Noticing where the conversation shifted…',
  'Finding a moment worth replaying…',
  'Choosing one thing to try next…',
];

/**
 * Brief → conversation → self-reflection → (coach reads) → debrief.
 * Reflection always comes before AI feedback; the debrief request carries it.
 */
function RoleplayFlow({ scenario, params }: { scenario: ScenarioSpec; params: Params }) {
  const opening: Turn[] = [{ id: 't0', speaker: 'employee', text: scenario.openingLine }];
  const [phase, setPhase] = useState<Phase>('brief');
  const [session, setSession] = useState(0);
  const [turns, setTurns] = useState<Turn[]>(opening);
  const [reflection, setReflection] = useState<SelfReflection | null>(null);
  const [debrief, setDebrief] = useState<DebriefData | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [reviewSent, setReviewSent] = useState(false);
  const before = usePracticeSnapshot();
  const recordPractice = useLearner((s) => s.recordPractice);
  const submitForReview = useLearner((s) => s.submitForReview);
  const trainer = useLearner((s) => s.assignment.assignedBy);
  const inflight = useRef<ReturnType<typeof withTimeout> | null>(null);
  const source = (params.source as PracticeSource) ?? 'practice';

  useEffect(() => () => inflight.current?.abort(), []);

  const requestDebrief = async (r: SelfReflection, t: Turn[]) => {
    setPhase('thinking');
    setError(null);
    const req = withTimeout(45_000);
    inflight.current?.abort();
    inflight.current = req;
    const started = Date.now();
    try {
      const d = await postJson<DebriefData>('/api/roleplay/debrief', { scenarioId: scenario.id, turns: t, selfReflection: r }, req.signal);
      // the coach takes a moment: long enough to read as intentional, never padded past ~2.4s
      await new Promise((res) => setTimeout(res, Math.max(0, 2400 - (Date.now() - started))));
      if (inflight.current !== req) return;
      setDebrief(normalize(d));
      setPhase('debrief');
      recordPractice({
        kind: 'roleplay',
        skill: scenario.primaryChallenge,
        refId: scenario.id,
        activityId: params.activityId,
        minutes: Number(params.minutes) || 10,
      });
    } catch (e) {
      if (inflight.current !== req) return;
      setError(friendlyError(e));
      haptic.warn();
    } finally {
      req.clear();
    }
  };

  const restart = () => {
    setTurns(opening);
    setReflection(null);
    setDebrief(null);
    setReviewSent(false);
    setSession((n) => n + 1);
    setPhase('chat');
  };

  const next = (c: NextChoice) => {
    if (c === 'try-again') return restart();
    if (c === 'same-skill') {
      const lvl = useLearner.getState().skills[scenario.primaryChallenge]?.level ?? 1;
      return openDrill(pickDrill(scenario.primaryChallenge, lvl), { minutes: 5, source, replace: true });
    }
    const target =
      c === 'harder'
        ? scenario.harderId
        : c === 'easier'
          ? scenario.easierId
          : SCENARIOS.filter((s) => s.id !== scenario.id)[Math.floor(Math.random() * (SCENARIOS.length - 1))]?.id;
    if (target) openRoleplay(target, { minutes: 12, source, replace: true });
  };

  let body: ReactNode;
  if (phase === 'brief') body = <Brief scenario={scenario} onStart={() => setPhase('chat')} onClose={() => router.back()} />;
  else if (phase === 'chat')
    body = (
      <Conversation
        key={session}
        scenario={scenario}
        turns={turns}
        onTurns={setTurns}
        onEnd={(t) => {
          setTurns(t);
          setPhase('reflect');
        }}
        onLeave={() => router.back()}
      />
    );
  else if (phase === 'reflect')
    body = (
      <Reflection
        name={scenario.persona.name}
        initial={reflection}
        onClose={() => router.back()}
        onSubmit={(r) => {
          setReflection(r);
          requestDebrief(r, turns);
        }}
      />
    );
  else if (phase === 'thinking')
    body = (
      <Thinking
        error={error}
        onRetry={() => reflection && requestDebrief(reflection, turns)}
        onBack={() => {
          inflight.current?.abort();
          setError(null);
          setPhase('reflect');
        }}
        onClose={() => router.back()}
      />
    );
  else if (debrief && reflection)
    body = (
      <Debrief
        scenario={scenario}
        turns={turns}
        reflection={reflection}
        debrief={debrief}
        before={before}
        trainer={trainer}
        reviewSent={reviewSent}
        onReview={(note) => {
          submitForReview({ scenarioId: scenario.id, turns, selfReflection: reflection, debrief, note: note || undefined });
          setReviewSent(true);
        }}
        onNext={next}
        onClose={() => router.back()}
      />
    );

  return <PhaseFade key={`${phase}-${session}`}>{body}</PhaseFade>;
}

/** Each phase arrives with a short rise; a cross-fade under reduced motion. */
function PhaseFade({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = reduce ? withTiming(1, { duration: FADE_MS }) : withSpring(1, spring.gentle);
  }, [p, reduce]);
  const style = useAnimatedStyle(() => (reduce ? { opacity: p.value } : { opacity: Math.min(1, p.value * 1.5), transform: [{ translateY: (1 - p.value) * 16 }] }));
  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

function Thinking({ error, onRetry, onBack, onClose }: { error: FriendlyError | null; onRetry: () => void; onBack: () => void; onClose: () => void }) {
  const focused = useIsFocused();
  return (
    <View style={sessionStyles.root}>
      <SessionHeader onClose={onClose} />
      <View style={styles.center}>
        {error ? (
          <Raised tone="surface" depth={5} contentStyle={styles.errorFace}>
            <WifiSlashIcon size={28} weight="bold" color={color.primary} />
            <Text variant="heading" align="center">
              {error.title}
            </Text>
            <Text variant="body" color={color.muted} align="center">
              {error.detail} Your conversation and reflection are saved.
            </Text>
          </Raised>
        ) : (
          <CoachThinking title="Reading the conversation" lines={THINKING_LINES} paused={!focused} />
        )}
      </View>
      {error ? (
        <Dock rule={false}>
          <Button label="Try again" fullWidth onPress={onRetry} />
          <Button variant="secondary" label="Back to my reflection" fullWidth onPress={onBack} style={styles.second} />
        </Dock>
      ) : null}
    </View>
  );
}

const EMPTY_TALLIES: MoveTallies = {
  openQuestions: 0,
  closedQuestions: 0,
  simpleReflections: 0,
  complexReflections: 0,
  affirmations: 0,
  summaries: 0,
  autonomySupport: 0,
  miInconsistent: 0,
};

/** Defensive defaults so a partial model response never breaks the screen. */
function normalize(d: DebriefData): DebriefData {
  return {
    annotations: d.annotations ?? [],
    tallies: { ...EMPTY_TALLIES, ...(d.tallies as Partial<MoveTallies> | undefined) },
    trajectory: (d.trajectory ?? []).map((v) => Math.max(-2, Math.min(2, Number(v) || 0))),
    reflectionResponse: d.reflectionResponse ?? '',
    strengths: d.strengths ?? [],
    keyMoments: (d.keyMoments ?? []).map((k) => ({ ...k, possibleResponses: k.possibleResponses ?? [] })),
    tryNext: d.tryNext ?? '',
    suggestedNextStep: d.suggestedNextStep ?? 'try-again',
  };
}

function Missing() {
  return (
    <View style={sessionStyles.root}>
      <SessionHeader onClose={() => router.back()} />
      <View style={styles.center}>
        <Text variant="heading" align="center">
          That scenario isn’t here yet.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.white },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.gutter },
  errorFace: { alignItems: 'center', gap: space[3], padding: space[6] },
  second: { marginTop: space[3] },
});
