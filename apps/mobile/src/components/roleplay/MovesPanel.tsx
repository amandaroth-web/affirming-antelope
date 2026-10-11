import type { MoveTallies } from '@antelope/core';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { callName } from '@/components/practice-loop/names';
import { MoveMarker } from '@/components/practice-loop/MoveMarker';
import { TALLY_ROWS } from '@/components/practice-loop/moves';
import { Text, border, color, haptic, moveColor, radius, space } from '@/design';
import { FADE_MS, RollingNumber, useReduceMotion } from '@/motion';

/**
 * "Your moves": counts per move as rolling counters (staggered), then a
 * reflections-vs-questions balance beam that tips toward the heavier side.
 * A balance to notice, not a grade.
 */
export function MovesPanel({ tallies, name, play = true, settled }: { tallies: MoveTallies; name: string; play?: boolean; settled?: boolean }) {
  const live = play || !!settled;
  const reflections = tallies.simpleReflections + tallies.complexReflections + tallies.summaries;
  const questions = tallies.openQuestions + tallies.closedQuestions;
  const first = callName(name);
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {TALLY_ROWS.map((r, i) => {
          const v = tallies[r.key] ?? 0;
          return (
            <View key={r.key} style={[styles.cell, v === 0 && styles.cellQuiet]} accessible accessibilityLabel={`${r.label}: ${v}`}>
              <MoveMarker family={r.family} size={13} />
              <Text variant="caption" color={v ? color.ink : color.muted} style={styles.cellLabel} numberOfLines={2}>
                {r.label}
              </Text>
              <RollingNumber value={live ? v : 0} from={settled ? v : 0} variant="subheading" delay={settled ? 0 : 80 + i * 70} color={v ? color.ink : color.faint} />
            </View>
          );
        })}
      </View>

      <Balance reflections={reflections} questions={questions} play={live} settled={settled} wait={80 + TALLY_ROWS.length * 70 + 220} />
      <Text variant="body" color={color.muted} style={styles.balanceCopy}>
        {reflections === 0 && questions === 0
          ? `This one was mostly statements. Next time, try one question and one reflection with ${first}.`
          : reflections >= questions
            ? `You reflected ${reflections} ${reflections === 1 ? 'time' : 'times'} and asked ${questions} ${questions === 1 ? 'question' : 'questions'}. Reflections keep ${first} doing the thinking.`
            : `You asked ${questions} ${questions === 1 ? 'question' : 'questions'} and reflected ${reflections} ${reflections === 1 ? 'time' : 'times'}. Many MI practitioners aim for about two reflections per question.`}
      </Text>
    </View>
  );
}

function Balance({ reflections, questions, play, settled, wait }: { reflections: number; questions: number; play: boolean; settled?: boolean; wait: number }) {
  const reduce = useReduceMotion();
  const target = Math.max(-12, Math.min(12, (questions - reflections) * 4));
  const tilt = useSharedValue(settled ? target : 0);
  useEffect(() => {
    if (!play || settled) return;
    // the beam waits for the tallies to land, then tips under their weight
    tilt.value = reduce ? withTiming(target, { duration: FADE_MS }) : withDelay(wait, withSpring(target, { damping: 7, stiffness: 90, mass: 1.1 }));
  }, [target, reduce, tilt, play, settled, wait]);
  // one light tick the first time the beam reaches its lean (its visual peak), not on every wobble
  const peaked = useSharedValue(settled || reduce || target === 0 ? 1 : 0);
  useAnimatedReaction(
    () => Math.abs(tilt.value) >= Math.abs(target) * 0.98,
    (hit, prev) => {
      if (hit && !prev && !peaked.value) {
        peaked.value = 1;
        scheduleOnRN(haptic.tick);
      }
    },
  );
  const beam = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));
  // pans hang level while the beam tips
  const panL = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.sin((tilt.value * Math.PI) / 180) * 100 }] }));
  const panR = useAnimatedStyle(() => ({ transform: [{ translateY: Math.sin((tilt.value * Math.PI) / 180) * 100 }] }));

  return (
    <View style={styles.balance} accessible accessibilityLabel={`Balance: ${reflections} reflections, ${questions} questions`}>
      <View style={styles.beamZone}>
        <Animated.View style={[styles.pan, styles.panLeft, panL]}>
          <Text variant="caption" color={color.ink}>
            Reflections
          </Text>
          <View style={[styles.panDisc, { borderColor: moveColor.reflection }]}>
            <Text variant="heading" color={moveColor.reflection}>
              {reflections}
            </Text>
          </View>
        </Animated.View>
        <Animated.View style={[styles.pan, styles.panRight, panR]}>
          <Text variant="caption" color={color.ink}>
            Questions
          </Text>
          <View style={[styles.panDisc, { borderColor: moveColor.question }]}>
            <Text variant="heading" color={moveColor.question}>
              {questions}
            </Text>
          </View>
        </Animated.View>
        <Animated.View style={[styles.beam, beam]} />
        <View style={styles.fulcrum} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  cell: {
    width: '48.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderWidth: border,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    minHeight: 52,
  },
  cellQuiet: { borderStyle: 'dashed' },
  cellLabel: { flex: 1 },
  balance: { alignItems: 'center', paddingTop: space[2] },
  beamZone: { width: 260, height: 112, alignItems: 'center' },
  beam: { position: 'absolute', top: 72, width: 200, height: 6, borderRadius: 3, backgroundColor: color.navy },
  fulcrum: {
    position: 'absolute',
    top: 75,
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderBottomWidth: 30,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: color.navy,
  },
  pan: { position: 'absolute', top: 0, width: 96, alignItems: 'center', gap: 2 },
  panLeft: { left: -18 },
  panRight: { right: -18 },
  panDisc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    backgroundColor: color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCopy: { textAlign: 'center' },
});
