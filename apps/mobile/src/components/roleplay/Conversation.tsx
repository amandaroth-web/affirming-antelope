import type { ScenarioSpec, Turn } from '@antelope/core';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Composer } from '@/components/practice-loop/Composer';
import { ConfirmSheet } from '@/components/practice-loop/ConfirmSheet';
import { Dock, KeyboardColumn, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import { EmployeeBubble, LearnerBubble, TypingDots, useBubbleEntrance } from '@/components/practice-loop/Speech';
import {
  ArrowCounterClockwiseIcon,
  Avatar,
  Button,
  CaretDownIcon,
  PressableSurface,
  TargetIcon,
  Text,
  color,
  haptic,
  layout,
  radius,
  space,
} from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';
import { useEmployeeReply } from './useEmployeeReply';

const MIN_TURNS = 3;

/**
 * The conversation. Feels like talking to a person, not a bot: the opening
 * line is already there, replies take a beat (typing dots) and then arrive at
 * a speaking pace. Auto-scroll follows the conversation unless you've scrolled
 * up to reread; then a "New reply" pill offers the way back. No live scores.
 */
export function Conversation({
  scenario,
  turns,
  onTurns,
  onEnd,
  onLeave,
}: {
  scenario: ScenarioSpec;
  turns: Turn[];
  onTurns: (t: Turn[]) => void;
  onEnd: (t: Turn[]) => void;
  onLeave: () => void;
}) {
  const p = scenario.persona;
  const first = p.name.split(' ')[0];
  const { pending, error, request, cut, clearError } = useEmployeeReply(scenario.id);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState<'end' | 'leave' | null>(null);
  const [goalOpen, setGoalOpen] = useState(true);
  const [unseen, setUnseen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  // replies that streamed in are already on screen; don't re-enter them when they settle
  const streamed = useRef(new Set<string>());

  const learnerCount = turns.filter((t) => t.speaker === 'learner').length;
  const ready = learnerCount >= MIN_TURNS;

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;
    const next: Turn[] = [...turns, { id: `t${turns.length}`, speaker: 'learner', text }];
    onTurns(next);
    setDraft('');
    atBottom.current = true;
    if (goalOpen && learnerCount === 0) setGoalOpen(false);
    ask(next);
  };

  const ask = (history: Turn[]) => {
    request(history, `t${history.length}`, (reply) => {
      if (!reply) return;
      const now = turnsRef.current;
      streamed.current.add(`t${now.length}`);
      onTurns([...now, { id: `t${now.length}`, speaker: 'employee', text: reply }]);
    });
  };

  const end = () => {
    // keep whatever has been said so far, including a reply mid-sentence
    const partial = pending && !pending.typing ? cut() : (cut(), '');
    const final = partial ? [...turns, { id: `t${turns.length}`, speaker: 'employee' as const, text: partial }] : turns;
    // the debrief needs the learner to have spoken at least once
    if (!final.some((t) => t.speaker === 'learner')) return onLeave();
    onEnd(final);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const near = contentOffset.y + layoutMeasurement.height >= contentSize.height - 56;
    atBottom.current = near;
    if (near && unseen) setUnseen(false);
  };

  const onContent = () => {
    if (atBottom.current) scroll.current?.scrollToEnd({ animated: true });
    else setUnseen(true);
  };

  return (
    <View style={sessionStyles.root}>
      <SessionHeader
        onClose={() => (learnerCount ? setConfirm('leave') : onLeave())}
        closeLabel="Leave conversation"
        center={
          <View style={styles.who}>
            <Avatar seed={p.avatarSeed} size={36} />
            <View style={styles.whoCopy}>
              <Text variant="label" numberOfLines={1}>
                {p.name}
              </Text>
              <Text variant="caption" color={color.muted} numberOfLines={1}>
                {pending?.typing ? 'typing…' : learnerCount ? `${learnerCount} ${learnerCount === 1 ? 'reply' : 'replies'} from you` : p.role}
              </Text>
            </View>
          </View>
        }
        trailing={<EndButton ready={ready} disabled={learnerCount === 0} onPress={() => (ready ? end() : setConfirm('end'))} />}
      />
      <GoalReminder goal={scenario.learnerGoal} open={goalOpen} onToggle={() => setGoalOpen((v) => !v)} />

      <KeyboardColumn>
        <View style={styles.flex}>
          <ScrollView
            ref={scroll}
            style={styles.flex}
            contentContainerStyle={[sessionStyles.scroll, styles.thread]}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onContentSizeChange={onContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={sessionStyles.column}>
              <Text variant="caption" color={color.muted} align="center" style={styles.stamp}>
                One-on-one with {first}
              </Text>
              {turns.map((t, i) => (
                <Message key={t.id} turn={t} seed={p.avatarSeed} name={p.name} delay={i === 0 ? 250 : 0} settled={streamed.current.has(t.id)} />
              ))}
              {pending ? (
                <PendingBubble seed={p.avatarSeed} name={p.name} text={pending.text} typing={pending.typing} />
              ) : null}
              {error ? (
                <View style={styles.retry}>
                  <Text variant="caption" color={color.muted} align="center">
                    {error.title}. {first} didn’t get that.
                  </Text>
                  <Button
                    variant="secondary"
                    size="sm"
                    label="Resend"
                    icon={<ArrowCounterClockwiseIcon size={16} weight="bold" color={color.primary} />}
                    iconPosition="leading"
                    onPress={() => {
                      clearError();
                      ask(turns);
                    }}
                    style={styles.center}
                  />
                </View>
              ) : null}
              {ready && !pending ? (
                <Text variant="caption" color={color.muted} align="center" style={styles.readyHint}>
                  End whenever you’re ready.
                </Text>
              ) : null}
            </View>
          </ScrollView>
          {unseen ? (
            <NewReplyPill
              onPress={() => {
                atBottom.current = true;
                setUnseen(false);
                scroll.current?.scrollToEnd({ animated: true });
              }}
            />
          ) : null}
        </View>
        <Dock>
          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={send}
            busy={!!pending || !!error}
            placeholder={`Reply to ${first}…`}
            accessibilityLabel={`Your reply to ${p.name}`}
          />
        </Dock>
      </KeyboardColumn>

      <ConfirmSheet
        open={confirm === 'end'}
        onClose={() => setConfirm(null)}
        title="End the conversation?"
        body={`You’ve had ${learnerCount} ${learnerCount === 1 ? 'exchange' : 'exchanges'} with ${first}. Ending now is fine; the debrief just has less to go on. A few more replies usually tells you more.`}
        stay="Keep talking"
        leave="End and reflect"
        onLeave={() => {
          setConfirm(null);
          setTimeout(end, 200);
        }}
      />
      <ConfirmSheet
        open={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        title="Leave this conversation?"
        body="It won’t be saved, and there’s no debrief. To get feedback, end the conversation instead."
        stay="Keep talking"
        leave="Leave"
        onLeave={() => {
          setConfirm(null);
          cut();
          setTimeout(onLeave, 200);
        }}
      />
    </View>
  );
}

function Message({ turn, seed, name, delay, settled }: { turn: Turn; seed: string; name: string; delay: number; settled: boolean }) {
  const enter = useBubbleEntrance(turn.speaker === 'learner' ? 'right' : 'left', delay, settled);
  return (
    <Animated.View style={[styles.msg, enter]}>
      {turn.speaker === 'learner' ? <LearnerBubble text={turn.text} /> : <EmployeeBubble text={turn.text} seed={seed} name={name} />}
    </Animated.View>
  );
}

function PendingBubble({ seed, name, text, typing }: { seed: string; name: string; text: string; typing: boolean }) {
  const enter = useBubbleEntrance('left', 120);
  return (
    <Animated.View style={[styles.msg, enter]} accessibilityLiveRegion="polite">
      <EmployeeBubble seed={seed} name={name}>
        {typing || !text ? <TypingDots /> : <Text variant="body">{text}</Text>}
      </EmployeeBubble>
    </Animated.View>
  );
}

/** End sits quiet until there's enough to debrief, then wakes up cobalt with a pop. */
function EndButton({ ready, disabled, onPress }: { ready: boolean; disabled: boolean; onPress: () => void }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(1);
  const was = useRef(ready);
  useEffect(() => {
    if (ready && !was.current) {
      haptic.tick();
      if (!reduce) s.value = withSequence(withSpring(1.16, spring.snappy), withSpring(1, spring.bouncy));
    }
    was.current = ready;
  }, [ready, reduce, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={style}>
      <PressableSurface
        tone={ready ? 'primary' : 'surface'}
        depth={3}
        radius={radius.sm}
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={ready ? 'End conversation' : 'End conversation early'}
        hitSlop={4}
        contentStyle={styles.endFace}
      >
        <Text variant="label" color={disabled ? color.faint : ready ? color.white : color.primary}>
          End
        </Text>
      </PressableSurface>
    </Animated.View>
  );
}

/** "Your goal": open at the start, folds away after the first reply, a tap brings it back. */
function GoalReminder({ goal, open, onToggle }: { goal: string; open: boolean; onToggle: () => void }) {
  const reduce = useReduceMotion();
  const [h, setH] = useState(0);
  const v = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    v.value = reduce ? withTiming(open ? 1 : 0, { duration: FADE_MS }) : withSpring(open ? 1 : 0, spring.settle);
  }, [open, reduce, v]);
  const body = useAnimatedStyle(() => ({ height: h * v.value, opacity: v.value }));
  const caret = useAnimatedStyle(() => ({ transform: [{ rotate: `${180 * v.value}deg` }] }));
  return (
    <View style={styles.goalWrap}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? `Your goal: ${goal}. Hide` : 'Show your goal'}
        style={styles.goal}
      >
        <View style={styles.goalHead}>
          <TargetIcon size={16} weight="bold" color={color.primary} />
          <Text variant="label" color={color.primaryShadow} style={styles.flex}>
            Your goal
          </Text>
          <Animated.View style={caret}>
            <CaretDownIcon size={16} weight="bold" color={color.primary} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.goalBody, body]}>
          <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={styles.goalMeasure}>
            <Text variant="body" color={color.ink} style={styles.goalText}>
              {goal}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function NewReplyPill({ onPress }: { onPress: () => void }) {
  const enter = useBubbleEntrance('left');
  return (
    <Animated.View style={[styles.pillWrap, enter]} pointerEvents="box-none">
      <PressableSurface tone="primary" depth={3} radius={radius.pill} onPress={onPress} accessibilityLabel="Jump to the new reply" contentStyle={styles.pill}>
        <CaretDownIcon size={14} weight="bold" color={color.white} />
        <Text variant="label" color={color.white}>
          New reply
        </Text>
      </PressableSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: space[2], maxWidth: 230 },
  whoCopy: { flexShrink: 1 },
  thread: { paddingTop: space[3], paddingBottom: space[5] },
  stamp: { marginBottom: space[4] },
  msg: { marginBottom: space[3] },
  retry: { gap: space[2], marginTop: space[2] },
  readyHint: { marginTop: space[2] },
  endFace: { minHeight: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  goalWrap: { paddingHorizontal: layout.gutter, paddingBottom: space[2], width: '100%', maxWidth: layout.maxWidth + 40, alignSelf: 'center' },
  goal: { backgroundColor: color.soft, borderRadius: radius.md, paddingHorizontal: space[4], paddingVertical: space[3] },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 20 },
  goalBody: { overflow: 'hidden' },
  goalMeasure: { position: 'absolute', left: 0, right: 0, top: 0 },
  goalText: { paddingTop: space[2], fontSize: 15, lineHeight: 21 },
  pillWrap: { position: 'absolute', bottom: space[3], alignSelf: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 36 },
});
