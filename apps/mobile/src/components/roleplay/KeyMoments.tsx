import type { KeyMoment, Turn } from '@antelope/core';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { LearnerBubble, PossibleResponse } from '@/components/practice-loop/Speech';
import { Text, border, color, layout, radius, space } from '@/design';

const GAP = 12;

/**
 * Key moments as horizontally swipeable cards that snap, with the next card
 * peeking. Each: what you said, what the coach noticed, two or three possible
 * MI-consistent responses, and why. Dots track the scroll on the UI thread.
 */
export function KeyMoments({ moments, turns }: { moments: KeyMoment[]; turns: Turn[] }) {
  const { width } = useWindowDimensions();
  // the next card peeks when there's more than one
  const cardW = Math.min(width, layout.maxWidth) - layout.gutter * 2 - (moments.length > 1 ? 24 : 0);
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  if (!moments.length) return null;

  return (
    <View>
      <Animated.ScrollView
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        style={styles.bleed}
      >
        {moments.map((m, i) => {
          const said = turns.find((t) => t.id === m.turnId);
          const exchange = turns.filter((t) => t.speaker === 'learner').findIndex((t) => t.id === m.turnId) + 1;
          return (
            <View key={m.turnId + i} style={[styles.card, { width: cardW }]}>
              <Text variant="overline" color={color.goldInk}>
                {exchange > 0 ? `Exchange ${exchange}` : 'Key moment'} · {i + 1} of {moments.length}
              </Text>
              {said ? (
                <View style={styles.block}>
                  <Text variant="caption" color={color.muted} style={styles.you}>
                    You said
                  </Text>
                  <LearnerBubble text={said.text} compact style={styles.left} />
                </View>
              ) : null}
              <Text variant="body" style={styles.block}>
                {m.observation}
              </Text>
              <View style={[styles.block, styles.responses]}>
                {m.possibleResponses.slice(0, 3).map((r, k) => (
                  <PossibleResponse key={k} text={r} index={k} />
                ))}
              </View>
              <View style={[styles.block, styles.why]}>
                <Text variant="label" color={color.primaryShadow}>
                  Why it helps
                </Text>
                <Text variant="body" color={color.muted}>
                  {m.why}
                </Text>
              </View>
            </View>
          );
        })}
      </Animated.ScrollView>
      {moments.length > 1 ? (
        <View style={styles.dots}>
          {moments.map((_, i) => (
            <Dot key={i} i={i} x={x} step={cardW + GAP} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Dot({ i, x, step }: { i: number; x: SharedValue<number>; step: number }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.value / step - i);
    return { width: interpolate(d, [0, 1], [20, 8], 'clamp'), backgroundColor: d < 0.5 ? color.gold : color.line };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -layout.gutter },
  track: { paddingHorizontal: layout.gutter, gap: GAP, alignItems: 'stretch' },
  card: {
    backgroundColor: color.white,
    borderRadius: radius.surface,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: 6,
    borderBottomColor: color.shadow,
    padding: space[5],
  },
  block: { marginTop: space[3] },
  you: { marginBottom: 4 },
  left: { alignItems: 'flex-start' },
  responses: { gap: space[2] },
  why: { gap: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space[4] },
  dot: { height: 8, borderRadius: 4 },
});
