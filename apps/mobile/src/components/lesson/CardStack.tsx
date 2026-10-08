import type { Lesson } from '@antelope/core';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { QuotesIcon, Text, border, color, haptic, radius, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';

type Card = Lesson['cards'][number];

export interface CardStackHandle {
  next: () => void;
  back: () => void;
}

const DEPTH_Y = 20;
const DEPTH_SCALE = 0.04;

/**
 * Physical card stack. The top card follows the finger, tilts with drag
 * distance and velocity, and either springs back or flies off carrying the
 * flick's velocity. Cards underneath rise to meet the gap as you drag.
 * Either direction advances; Back flies the previous card in from the left.
 */
export const CardStack = forwardRef<CardStackHandle, { cards: Card[]; index: number; onIndex: (i: number) => void; onPastEnd: () => void }>(
  function CardStack({ cards, index, onIndex, onPastEnd }, ref) {
    const { width: winW } = useWindowDimensions();
    const reduce = useReduceMotion();
    const W = Math.min(winW, 560);
    const threshold = W * 0.28;
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);
    const tilt = useSharedValue(0);
    const active = useSharedValue(index);
    const busy = useSharedValue(0);
    const fade = useSharedValue(1);
    const [backFrom, setBackFrom] = useState<number | null>(null);
    const [areaH, setAreaH] = useState(0);
    const cardH = Math.max(320, Math.min(areaH - DEPTH_Y * 2 - 8, 500));

    const last = cards.length - 1;

    const advance = (to: number) => {
      onIndex(to);
    };

    const fly = (dir: number, velocity = 0) => {
      'worklet';
      if (busy.value) return;
      const cur = active.value;
      if (cur >= last) {
        // last card: settle back and hand off to the finish
        tx.value = withSpring(0, spring.release);
        ty.value = withSpring(0, spring.release);
        tilt.value = withSpring(0, spring.release);
        scheduleOnRN(onPastEnd);
        return;
      }
      busy.value = 1;
      const done = (f?: boolean) => {
        'worklet';
        if (!f) return;
        active.value = cur + 1;
        tx.value = 0;
        ty.value = 0;
        tilt.value = 0;
        busy.value = 0;
        scheduleOnRN(advance, cur + 1);
      };
      tx.value = withSpring(dir * W * 1.5, { ...spring.gentle, stiffness: 140, velocity: velocity || dir * 1400, overshootClamping: true }, done);
    };

    // Button path (JS): same flight as a flick, launched with a default velocity.
    const flyFromButton = () => {
      if (busy.value) return;
      const cur = active.value;
      if (cur >= last) return onPastEnd();
      busy.value = 1;
      tilt.value = withSpring(-4, spring.gentle);
      tx.value = withSpring(-W * 1.5, { ...spring.gentle, stiffness: 140, velocity: -1400, overshootClamping: true }, (f) => {
        'worklet';
        if (!f) return;
        active.value = cur + 1;
        tx.value = 0;
        ty.value = 0;
        tilt.value = 0;
        busy.value = 0;
        scheduleOnRN(advance, cur + 1);
      });
    };

    // Reduced motion: no travel, the next card cross-fades in.
    const fadeNext = () => {
      if (index >= last) return onPastEnd();
      fade.value = withSequence(withTiming(0, { duration: FADE_MS / 2 }), withTiming(1, { duration: FADE_MS }));
      setTimeout(() => {
        active.value = index + 1;
        onIndex(index + 1);
      }, FADE_MS / 2);
    };

    useImperativeHandle(ref, () => ({
      next: () => (reduce ? fadeNext() : flyFromButton()),
      back: () => {
        if (index <= 0 || busy.value) return;
        if (reduce) {
          active.value = index - 1;
          onIndex(index - 1);
          return;
        }
        setBackFrom(index - 1);
        onIndex(index - 1);
      },
    }));

    // Back: once the previous card is mounted, put it off-screen left and spring it home.
    useEffect(() => {
      if (backFrom === null || backFrom !== index) return;
      active.value = index;
      tx.value = withSequence(withTiming(-W * 1.3, { duration: 0 }), withSpring(0, spring.gentle));
      tilt.value = withSequence(withTiming(-6, { duration: 0 }), withSpring(0, spring.gentle));
      setBackFrom(null);
    }, [backFrom, index, W, active, tx, tilt]);

    // Threshold tick while dragging: you feel the point of no return.
    useAnimatedReaction(
      () => Math.abs(tx.value) > threshold,
      (past, prev) => {
        if (prev !== null && past !== prev && busy.value === 0) scheduleOnRN(haptic.tick);
      },
    );

    const pan = Gesture.Pan()
      .activeOffsetX([-10, 10])
      .onUpdate((e) => {
        if (busy.value || reduce) return;
        tx.value = e.translationX;
        ty.value = e.translationY * 0.25;
        tilt.value = withSpring(Math.max(-9, Math.min(9, e.velocityX / 140)), spring.snappy);
      })
      .onEnd((e) => {
        if (busy.value) return;
        if (reduce) {
          if (Math.abs(e.translationX) > threshold * 0.6 || Math.abs(e.velocityX) > 900) scheduleOnRN(fadeNext);
          return;
        }
        const out = Math.abs(tx.value) > threshold || Math.abs(e.velocityX) > 900;
        if (out) {
          const dir = Math.sign(tx.value || e.velocityX) || -1;
          tilt.value = withSpring(dir * 4, spring.gentle);
          fly(dir, e.velocityX);
        } else {
          tx.value = withSpring(0, { ...spring.release, velocity: e.velocityX });
          ty.value = withSpring(0, spring.release);
          tilt.value = withSpring(0, spring.release);
        }
      });

    const visible = [index, index + 1, index + 2].filter((i) => i <= last);

    return (
      <GestureDetector gesture={pan}>
        <View
          style={styles.area}
          onLayout={(e) => setAreaH(e.nativeEvent.layout.height)}
          accessibilityRole="adjustable"
          accessibilityLabel={`Card ${index + 1} of ${cards.length}`}
        >
          {areaH > 0 && visible
            .slice()
            .reverse()
            .map((i) => (
              <StackCard
                key={i}
                i={i}
                card={cards[i]}
                count={cards.length}
                W={W}
                H={cardH}
                top={Math.max(0, (areaH - cardH - DEPTH_Y * 2) / 2)}
                threshold={threshold}
                tx={tx}
                ty={ty}
                tilt={tilt}
                active={active}
                fade={fade}
              />
            ))}
        </View>
      </GestureDetector>
    );
  },
);

function StackCard({
  i,
  card,
  count,
  W,
  H,
  top,
  threshold,
  tx,
  ty,
  tilt,
  active,
  fade,
}: {
  i: number;
  card: Card;
  count: number;
  W: number;
  H: number;
  top: number;
  threshold: number;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  tilt: SharedValue<number>;
  active: SharedValue<number>;
  fade: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const depth = i - active.value;
    if (depth < 0) return { opacity: 0 };
    if (depth === 0) {
      const rot = (tx.value / W) * 12 + tilt.value;
      return {
        opacity: fade.value,
        zIndex: 10,
        transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${rot}deg` }],
      };
    }
    // rise toward the next slot as the top card leaves
    const p = Math.min(1, Math.abs(tx.value) / (threshold * 1.6));
    const d = depth - p;
    return {
      opacity: interpolate(d, [1, 2, 2.6], [1, 0.9, 0], 'clamp') * fade.value,
      zIndex: 10 - depth,
      transform: [{ translateY: d * DEPTH_Y }, { scale: 1 - d * DEPTH_SCALE }],
    };
  });

  // cards underneath read as paper waiting in the stack; their words surface as they rise
  const content = useAnimatedStyle(() => {
    const depth = i - active.value;
    if (depth <= 0) return { opacity: 1 };
    const p = Math.min(1, Math.abs(tx.value) / (threshold * 1.6));
    return { opacity: interpolate(depth - p, [0, 0.6], [1, 0], 'clamp') };
  });

  const example = card.example ? unquote(card.example) : null;

  return (
    <Animated.View style={[styles.cardWrap, { top, height: H }, style]} pointerEvents="box-none">
      <View style={styles.cardShadow} />
      <View style={styles.card}>
        <Animated.View style={[styles.cardContent, content]}>
        <Text variant="overline" color={color.primaryShadow}>
          {i + 1} of {count}
        </Text>
        <Text variant="title" style={styles.heading} accessibilityRole="header">
          {card.heading}
        </Text>
        <Text variant="body" style={styles.body} maxScale={1.4}>
          {card.body}
        </Text>
        {example ? (
          <View style={styles.example}>
            <View style={styles.exampleHead}>
              <QuotesIcon size={16} weight="fill" color={color.primary} />
              <Text variant="overline" color={color.primaryShadow}>
                You might say
              </Text>
            </View>
            <View style={styles.exampleBubble}>
              <Text variant="bodyStrong" style={styles.exampleText} maxScale={1.4}>
                {example}
              </Text>
            </View>
          </View>
        ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** Lesson examples arrive wrapped in straight quotes; show them as speech, curly-quoted. */
function unquote(s: string) {
  const t = s.trim();
  const inner = t.replace(/^"/, '').replace(/"$/, '');
  if (!inner.includes('"')) return `“${inner}”`;
  return t.replace(/"([^"]*)"/g, '“$1”');
}

const styles = StyleSheet.create({
  area: { flex: 1, justifyContent: 'center' },
  cardWrap: { position: 'absolute', left: 0, right: 0 },
  cardShadow: { position: 'absolute', left: 0, right: 0, top: 6, bottom: -6, borderRadius: radius.illustration, backgroundColor: color.shadow },
  card: {
    flex: 1,
    backgroundColor: color.white,
    borderRadius: radius.illustration,
    borderWidth: border,
    borderColor: color.line,
    padding: space[6],
    paddingTop: space[6],
  },
  cardContent: { flex: 1 },
  heading: { marginTop: space[3] },
  body: { marginTop: space[4], fontSize: 17, lineHeight: 25 },
  example: { marginTop: 'auto', paddingTop: space[5], gap: space[2] },
  exampleHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  exampleBubble: {
    backgroundColor: color.soft,
    borderRadius: radius.surface,
    borderTopLeftRadius: 6,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
  },
  exampleText: { fontSize: 16, lineHeight: 23, color: color.ink },
});
