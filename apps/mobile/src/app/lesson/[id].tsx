import { getLesson, getUnit } from '@antelope/core';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { CardStack, type CardStackHandle } from '@/components/lesson/CardStack';
import { CompletionMoment, usePracticeSnapshot } from '@/components/practice-loop/Completion';
import { Dock, SessionHeader, sessionStyles } from '@/components/practice-loop/SessionChrome';
import { SessionSurface, useSessionClose } from '@/components/practice-loop/SessionSurface';
import { ArrowRightIcon, Button, CaretLeftIcon, Text, color, layout, space } from '@/design';
import { findActivity, openActivity } from '@/data/routes';
import { practiceSource, track } from '@/lib/analytics';
import { FADE_MS, spring, useReduceMotion } from '@/motion';
import { nextActivity, useCompletedActivityIds } from '@/state/selectors';
import { activePathwayId, useLearner } from '@/state/store';

export default function LessonScreen() {
  return (
    <SessionSurface>
      <LessonSession />
    </SessionSurface>
  );
}

function LessonSession() {
  const close = useSessionClose();
  const { id, activityId, minutes, source } = useLocalSearchParams<{ id: string; activityId?: string; minutes?: string; source?: string }>();
  const lesson = getLesson(id);
  const stack = useRef<CardStackHandle>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const before = usePracticeSnapshot();
  const recordPractice = useLearner((s) => s.recordPractice);
  const completed = useCompletedActivityIds();
  const unit = lesson ? getUnit(lesson.unitId) : undefined;

  useEffect(() => {
    if (!lesson) return;
    track('practice_started', { kind: 'lesson', ref_id: lesson.id, ...(unit?.skills[0] ? { skill: unit.skills[0] } : {}), source: practiceSource(source), pathway_id: activePathwayId(), mode: 'text' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!lesson) return <Missing />;
  const last = index === lesson.cards.length - 1;

  const finish = () => {
    if (done) return;
    // the completion stamp lands with its own haptic (PracticeTicks); one beat, not two
    recordPractice({
      kind: 'learn',
      skill: unit?.skills[0],
      refId: lesson.id,
      activityId,
      minutes: Number(minutes) || findActivity(activityId)?.minutes || 4,
    });
    setDone(true);
  };

  if (done) {
    // completion: the next thing in this unit, so the learner never hits a dead end
    const up = activityId && unit ? nextActivity(unit, completed) : undefined;
    return (
      <View style={sessionStyles.root}>
        <SessionHeader onClose={close} />
        <View style={styles.doneBody}>
          <CompletionMoment title="Lesson done" subtitle={`${lesson.title}. Now try it out loud.`} before={before}>
            <Dock rule={false} style={styles.flush}>
              {up ? (
                <View style={styles.upNext}>
                  <Text variant="caption" color={color.muted}>
                    Up next in week {unit?.week}
                  </Text>
                  <Text variant="subheading" numberOfLines={2}>
                    {up.title}
                  </Text>
                </View>
              ) : null}
              <Button
                label={up ? 'Start next' : 'Done'}
                fullWidth
                onPress={() => {
                  track('next_step_chosen', { from: 'lesson', choice: up ? 'one_more' : 'done' });
                  if (up) openActivity(up, 'next_step', { replace: true });
                  else close();
                }}
                icon={up ? <ArrowRightIcon size={20} weight="bold" color={color.white} /> : undefined}
              />
              {up ? <Button variant="secondary" label="Back to my path" fullWidth onPress={close} style={styles.second} /> : null}
            </Dock>
          </CompletionMoment>
        </View>
      </View>
    );
  }

  return (
    <View style={sessionStyles.root}>
      <SessionHeader
        onClose={close}
        center={<Progress count={lesson.cards.length} index={index} />}
        trailing={
          <Text variant="caption" color={color.muted}>
            {index + 1}/{lesson.cards.length}
          </Text>
        }
      />
      <View style={styles.titleRow}>
        <Text variant="overline" color={color.muted} numberOfLines={1}>
          Lesson · {lesson.title}
        </Text>
      </View>
      <View style={styles.stage}>
        <CardStack ref={stack} cards={lesson.cards} index={index} onIndex={setIndex} onPastEnd={finish} />
      </View>
      <Dock rule={false}>
        <View style={styles.actions}>
          {index > 0 ? (
            <Button
              variant="secondary"
              label="Back"
              size="lg"
              onPress={() => stack.current?.back()}
              icon={<CaretLeftIcon size={18} weight="bold" color={color.primary} />}
              iconPosition="leading"
              accessibilityLabel="Previous card"
            />
          ) : null}
          <View style={styles.flex}>
            <Button label={last ? 'Finish' : 'Next'} fullWidth onPress={() => (last ? finish() : stack.current?.next())} />
          </View>
        </View>
        <Text variant="caption" color={color.muted} align="center" style={styles.hint}>
          {index === 0 ? 'Swipe the card or tap Next' : ' '}
        </Text>
      </Dock>
    </View>
  );
}

/** Progress dots: done dots are cobalt, the current one stretches into a pill. */
function Progress({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: count, now: index + 1 }}>
      {Array.from({ length: count }, (_, i) => (
        <ProgressDot key={i} state={i < index ? 'done' : i === index ? 'now' : 'todo'} />
      ))}
    </View>
  );
}

function ProgressDot({ state }: { state: 'done' | 'now' | 'todo' }) {
  const reduce = useReduceMotion();
  const w = useSharedValue(state === 'now' ? 22 : 8);
  const on = useSharedValue(state === 'todo' ? 0 : 1);
  useEffect(() => {
    w.value = reduce ? withTiming(state === 'now' ? 22 : 8, { duration: FADE_MS }) : withSpring(state === 'now' ? 22 : 8, spring.snappy);
    on.value = withTiming(state === 'todo' ? 0 : 1, { duration: 160 });
  }, [state, reduce, w, on]);
  const style = useAnimatedStyle(() => ({
    width: w.value,
    backgroundColor: on.value > 0.5 ? color.primary : color.line,
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

function Missing() {
  const close = useSessionClose();
  return (
    <View style={sessionStyles.root}>
      <SessionHeader onClose={close} />
      <View style={styles.doneBody}>
        <Text variant="heading" align="center">
          That lesson isn’t here yet.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { paddingHorizontal: layout.gutter, marginBottom: space[3], width: '100%', maxWidth: layout.maxWidth + 40, alignSelf: 'center' },
  stage: { flex: 1, paddingHorizontal: layout.gutter, width: '100%', maxWidth: layout.maxWidth + 40, alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: space[3], alignItems: 'flex-end' },
  flex: { flex: 1 },
  hint: { marginTop: space[2] },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  doneBody: { flex: 1, paddingHorizontal: layout.gutter, justifyContent: 'center' },
  upNext: { marginBottom: space[4], gap: 2 },
  second: { marginTop: space[3] },
  flush: { paddingHorizontal: 0 },
});
