import { getScenario, getSkill, type Debrief as DebriefData, type NextStep, type ScenarioSpec, type SelfReflection, type Turn } from '@antelope/core';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Mascot } from '@/components/mascot';
import { PracticeTicks, type PracticeSnapshot } from '@/components/practice-loop/Completion';
import { Dock, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  Avatar,
  BarbellIcon,
  Button,
  CaretRightIcon,
  CheckIcon,
  Chip,
  LightbulbIcon,
  PressableSurface,
  SealCheckIcon,
  ShuffleIcon,
  Text,
  TrendUpIcon,
  border,
  color,
  radius,
  space,
} from '@/design';
import { Enter } from '@/motion';
import { KeyMoments } from './KeyMoments';
import { MovesPanel } from './MovesPanel';
import { ReplayChart, type Exchange } from './ReplayChart';
import { ReviewSheet } from './ReviewSheet';

export type NextChoice = NextStep | 'easier';

const FEELING: Record<SelfReflection['feeling'], string> = { rough: 'Rough', mixed: 'Mixed', solid: 'Solid' };

/**
 * The payoff. Coach responds to your own read first, then the replay chart,
 * your moves, strengths, key moments, one thing to try, and what next (never
 * a dead end). Trainer review is opt-in, for this session only.
 */
export function Debrief({
  scenario,
  turns,
  reflection,
  debrief,
  before,
  trainer,
  reviewSent,
  onReview,
  onNext,
  onClose,
}: {
  scenario: ScenarioSpec;
  turns: Turn[];
  reflection: SelfReflection;
  debrief: DebriefData;
  before: PracticeSnapshot;
  trainer: { name: string; role: string };
  reviewSent: boolean;
  onReview: (note: string) => void;
  onNext: (c: NextChoice) => void;
  onClose: () => void;
}) {
  const focused = useIsFocused();
  const p = scenario.persona;
  const first = p.name.split(' ')[0];
  const [review, setReview] = useState(false);
  // a few celebratory hops when it's earned, then the antelope settles
  const [cheer, setCheer] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setCheer(false), 3400);
    return () => clearTimeout(t);
  }, []);
  const scroll = useRef<ScrollView>(null);

  const exchanges = useMemo(() => buildExchanges(turns, debrief), [turns, debrief]);
  const traj = exchanges.map((e) => e.value);
  const net = traj.length > 1 ? traj[traj.length - 1] - traj[0] : 0;
  const celebrate = net >= 1 || (traj[traj.length - 1] ?? 0) >= 1;

  const harder = scenario.harderId ? getScenario(scenario.harderId) : undefined;
  const easier = scenario.easierId ? getScenario(scenario.easierId) : undefined;
  const suggested: NextChoice = debrief.suggestedNextStep === 'harder' && !harder ? 'new-scenario' : debrief.suggestedNextStep;
  const skill = getSkill(scenario.primaryChallenge);

  const options: { key: NextChoice; title: string; detail: string; icon: ReactNode; short: string }[] = [
    { key: 'try-again', title: 'Try again', detail: `Same scenario, a fresh conversation with ${first}.`, icon: <ArrowCounterClockwiseIcon size={22} weight="bold" color={color.primary} />, short: 'Try again' },
    { key: 'same-skill', title: 'Practice this skill', detail: `A short drill on ${skill.name.toLowerCase()}.`, icon: <BarbellIcon size={22} weight="bold" color={color.primary} />, short: 'Practice skill' },
    ...(harder
      ? [{ key: 'harder' as const, title: 'Try a harder scenario', detail: `${harder.persona.name}: “${harder.title}”`, icon: <TrendUpIcon size={22} weight="bold" color={color.primary} />, short: 'Try harder' }]
      : []),
    ...(easier
      ? [{ key: 'easier' as const, title: 'Try an easier one', detail: `${easier.persona.name}: “${easier.title}”`, icon: <TrendUpIcon size={22} weight="bold" color={color.primary} style={{ transform: [{ scaleY: -1 }] }} />, short: 'Try easier' }]
      : []),
    { key: 'new-scenario', title: 'New scenario', detail: 'Someone new, a different conversation.', icon: <ShuffleIcon size={22} weight="bold" color={color.primary} />, short: 'New scenario' },
  ];
  const pick = options.find((o) => o.key === suggested) ?? options[0];

  return (
    <View style={sessionStyles.root}>
      <SessionHeader
        onClose={onClose}
        center={
          <View style={styles.headCenter}>
            <Text variant="subheading">Debrief</Text>
            <Text variant="caption" color={color.muted} numberOfLines={1}>
              {scenario.title}
            </Text>
          </View>
        }
      />
      <ScrollView ref={scroll} contentContainerStyle={[sessionStyles.scroll, styles.content]} showsVerticalScrollIndicator={false}>
        <View style={sessionStyles.column}>
          {/* coach answers your own read first */}
          <Enter from="scale" style={styles.coach}>
            <Mascot
              pose={celebrate ? 'celebrate' : 'head'}
              mood={celebrate && cheer ? 'cheer' : 'idle'}
              size={celebrate ? 112 : 84}
              paused={!focused}
              accessibilityLabel={celebrate ? 'The antelope coach, celebrating' : 'The antelope coach'}
            />
            <View style={styles.coachBubble}>
              <Text variant="overline" color={color.primaryShadow}>
                You called it {FEELING[reflection.feeling].toLowerCase()}
              </Text>
              <Text variant="body" style={styles.coachText}>
                {debrief.reflectionResponse}
              </Text>
            </View>
          </Enter>

          <Enter index={1} style={styles.ticks}>
            <PracticeTicks before={before} compact delay={900} />
          </Enter>

          <Section index={2} title="How the conversation moved">
            <ReplayChart exchanges={exchanges} name={p.name} seed={p.avatarSeed} />
          </Section>

          <Section index={3} title="Your moves">
            <MovesPanel tallies={debrief.tallies} name={p.name} />
          </Section>

          {debrief.strengths.length ? (
            <Section index={4} title="What went well">
              <View style={styles.strengths}>
                {debrief.strengths.map((s, i) => (
                  <View key={i} style={styles.strength}>
                    <SealCheckIcon size={22} weight="fill" color={color.gold} />
                    <Text variant="body" style={styles.flex}>
                      {s}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {debrief.keyMoments.length ? (
            <Section index={5} title="Key moments" caption={debrief.keyMoments.length > 1 ? 'Swipe for more' : undefined}>
              <KeyMoments moments={debrief.keyMoments} turns={turns} />
            </Section>
          ) : null}

          <Section index={6} title="Try next">
            <View style={styles.tryNext}>
              <View style={styles.tryIcon}>
                <LightbulbIcon size={22} weight="fill" color={color.white} />
              </View>
              <Text variant="bodyStrong" style={styles.flex}>
                {debrief.tryNext}
              </Text>
            </View>
          </Section>

          <Section index={7} title="What next">
            <View style={styles.options}>
              {options.map((o) => {
                const isPick = o.key === pick.key;
                return (
                  <PressableSurface
                    key={o.key}
                    onPress={() => onNext(o.key)}
                    tone={isPick ? 'soft' : 'surface'}
                    edge={isPick ? color.primary : undefined}
                    shadow={isPick ? color.primary : undefined}
                    depth={4}
                    radius={radius.surface}
                    accessibilityLabel={`${o.title}. ${o.detail}${isPick ? ". Coach's pick" : ''}`}
                    contentStyle={styles.option}
                  >
                    <View style={[styles.optionIcon, isPick && styles.optionIconPick]}>{o.icon}</View>
                    <View style={styles.flex}>
                      <View style={styles.optionTitle}>
                        <Text variant="subheading" color={isPick ? color.primaryShadow : color.ink}>
                          {o.title}
                        </Text>
                        {isPick ? <Chip label="Coach’s pick" tone="primary" /> : null}
                      </View>
                      <Text variant="caption" color={color.muted} numberOfLines={2}>
                        {o.detail}
                      </Text>
                    </View>
                    <CaretRightIcon size={18} weight="bold" color={color.faint} />
                  </PressableSurface>
                );
              })}
            </View>
          </Section>

          <Enter index={8} style={styles.reviewWrap}>
            <PressableSurface
              onPress={() => setReview(true)}
              tone="surface"
              depth={4}
              radius={radius.surface}
              accessibilityLabel={reviewSent ? `Sent to ${trainer.name}` : `Submit for trainer review. Share only this session with ${trainer.name}`}
              contentStyle={styles.review}
            >
              <Avatar seed="rosa-lin-trainer" size={44} />
              <View style={styles.flex}>
                <Text variant="subheading">{reviewSent ? `Sent to ${trainer.name}` : 'Submit for trainer review'}</Text>
                <Text variant="caption" color={color.muted}>
                  {reviewSent ? 'She’ll review this session before group.' : `Share only this session with ${trainer.name}.`}
                </Text>
              </View>
              {reviewSent ? (
                <View style={styles.sentTick}>
                  <CheckIcon size={14} weight="bold" color={color.white} />
                </View>
              ) : (
                <CaretRightIcon size={18} weight="bold" color={color.faint} />
              )}
            </PressableSurface>
          </Enter>

          <Text variant="caption" color={color.muted} align="center" style={styles.footnote}>
            Feedback is AI-generated, one possible read of the conversation. You and your trainer are the judges.
          </Text>
        </View>
      </ScrollView>
      <Dock>
        <Button label={pick.short} fullWidth onPress={() => onNext(pick.key)} icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />} />
      </Dock>

      <ReviewSheet
        open={review}
        onClose={() => setReview(false)}
        trainer={trainer}
        turnCount={turns.length}
        feeling={FEELING[reflection.feeling]}
        sent={reviewSent}
        onSend={onReview}
      />
    </View>
  );
}

function Section({ index, title, caption, children }: { index: number; title: string; caption?: string; children: ReactNode }) {
  return (
    <Enter index={index} style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {caption ? (
          <Text variant="caption" color={color.muted}>
            {caption}
          </Text>
        ) : null}
      </View>
      {children}
    </Enter>
  );
}

/** Pair each employee turn with the learner turn that prompted it, plus the observer's notes. */
export function buildExchanges(turns: Turn[], d: DebriefData): Exchange[] {
  const ann = new Map(d.annotations.map((a) => [a.turnId, a]));
  const keys = new Set(d.keyMoments.map((k) => k.turnId));
  const employee = turns.filter((t) => t.speaker === 'employee');
  return employee.map((e, i) => {
    const at = turns.indexOf(e);
    const prev = turns[at - 1];
    const learner = prev?.speaker === 'learner' ? prev : undefined;
    const ea = ann.get(e.id);
    const la = learner ? ann.get(learner.id) : undefined;
    const raw = d.trajectory[i] ?? ea?.intensity ?? 0;
    return {
      index: i,
      value: Number.isFinite(raw) ? raw : 0,
      employee: e,
      employeeNote: ea?.note,
      stance: ea?.stance,
      learner,
      move: la?.move,
      learnerNote: la?.note,
      keyMoment: !!learner && keys.has(learner.id),
    };
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headCenter: { alignItems: 'center', maxWidth: 240 },
  content: { paddingTop: space[2], paddingBottom: space[8] },
  coach: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  coachBubble: {
    flex: 1,
    backgroundColor: color.white,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: 5,
    borderBottomColor: color.shadow,
    borderRadius: radius.surface,
    borderBottomLeftRadius: 6,
    padding: space[4],
    marginBottom: space[2],
  },
  coachText: { marginTop: 4 },
  ticks: { marginTop: space[5] },
  section: { marginTop: space[8] },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space[3] },
  strengths: { gap: space[3] },
  strength: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  tryNext: {
    flexDirection: 'row',
    gap: space[4],
    alignItems: 'center',
    backgroundColor: color.soft,
    borderRadius: radius.surface,
    padding: space[5],
  },
  tryIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  options: { gap: space[3] },
  option: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  optionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  optionIconPick: { backgroundColor: color.white },
  optionTitle: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' },
  reviewWrap: { marginTop: space[6] },
  review: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  sentTick: { width: 26, height: 26, borderRadius: 13, backgroundColor: color.gold, alignItems: 'center', justifyContent: 'center' },
  footnote: { marginTop: space[6], paddingHorizontal: space[4] },
});
