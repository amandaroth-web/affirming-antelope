import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type TextLayoutLine, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Text } from '@/design';
import { color } from '@/design/tokens';
import { FADE_MS, useReduceMotion } from '@/motion';

/** Reveal speed, pt of line width per second. Fast enough to read along, never something you wait for. */
const SPEED = 820;
const MAX_TOTAL = 1400;

/**
 * The coach's words typing in. The paragraph is laid out once at its final
 * size (so the bubble never grows or jumps); each line is uncovered left to
 * right by a curtain in the bubble's colour, one line after another, with a
 * thin cobalt caret riding the leading edge. All UI thread: one shared clock,
 * no per-character re-render. Total time scales with length, capped at ~1.4s.
 *
 * `play` false: hidden (waiting its turn). `settled`: shown at once.
 * Reduced motion, or a platform without onTextLayout (web): a short fade.
 */
export function TypeIn({
  text,
  play = true,
  settled,
  onDone,
  bg = color.white,
  style,
}: {
  text: string;
  play?: boolean;
  settled?: boolean;
  onDone?: () => void;
  bg?: string;
  style?: StyleProp<TextStyle>;
}) {
  const reduce = useReduceMotion();
  const [lines, setLines] = useState<TextLayoutLine[] | null>(null);
  const [fallback, setFallback] = useState(Platform.OS === 'web');
  const t = useSharedValue(0); // ms along the reveal
  const fade = useSharedValue(settled ? 1 : 0);
  const done = useRef(false);
  const instant = settled || reduce || fallback;

  // web has no onTextLayout; if lines never arrive, fall back to a fade
  useEffect(() => {
    if (instant || lines) return;
    const id = setTimeout(() => setFallback(true), 250);
    return () => clearTimeout(id);
  }, [instant, lines]);

  const plan = (lines ?? []).map((l) => l.width / SPEED * 1000);
  const total = plan.reduce((a, b) => a + b, 0);
  const k = total > MAX_TOTAL ? MAX_TOTAL / total : 1;
  const starts: number[] = [];
  plan.reduce((acc, d) => {
    starts.push(acc);
    return acc + d * k;
  }, 0);
  const end = total * k;

  useEffect(() => {
    if (!play) return;
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDone?.();
    };
    if (instant) {
      fade.value = settled ? 1 : withTiming(1, { duration: FADE_MS });
      const id = setTimeout(finish, settled ? 0 : FADE_MS);
      return () => clearTimeout(id);
    }
    if (!lines) return;
    fade.value = 1;
    const landed = (f?: boolean) => {
      'worklet';
      if (f) scheduleOnRN(finish);
    };
    t.value = withDelay(60, withTiming(end, { duration: end, easing: Easing.linear }, landed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, instant, lines, end]);

  const shown = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View>
      <Animated.View style={shown}>
        <Text variant="body" style={style} onTextLayout={instant ? undefined : (e) => !lines && setLines(e.nativeEvent.lines)}>
          {text}
        </Text>
      </Animated.View>
      {!instant && lines && !done.current
        ? lines.map((l, i) => <Curtain key={i} line={l} t={t} start={starts[i]} dur={plan[i] * k} bg={bg} />)
        : null}
    </View>
  );
}

function Curtain({ line, t, start, dur, bg }: { line: TextLayoutLine; t: SharedValue<number>; start: number; dur: number; bg: string }) {
  const cover = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (t.value - start) / Math.max(1, dur)));
    const edge = line.x + line.width * p;
    return { left: edge, opacity: p >= 1 ? 0 : 1 };
  });
  const caret = useAnimatedStyle(() => {
    const p = (t.value - start) / Math.max(1, dur);
    return { opacity: p > 0 && p < 1 ? 1 : 0, transform: [{ translateX: line.x + line.width * Math.min(1, Math.max(0, p)) }] };
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.curtain, { top: line.y, height: line.height, backgroundColor: bg }, cover]} />
      <Animated.View pointerEvents="none" style={[styles.caret, { top: line.y + 3, height: line.height - 6 }, caret]} />
    </>
  );
}

const styles = StyleSheet.create({
  curtain: { position: 'absolute', right: -2 },
  caret: { position: 'absolute', left: 0, width: 2, borderRadius: 1, backgroundColor: color.primary },
});
