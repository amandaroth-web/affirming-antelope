import type { DrillFeedback } from '@antelope/core';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { movePhrase } from '@/components/practice-loop/moves';
import { PossibleResponse } from '@/components/practice-loop/Speech';
import { Chip, LightbulbIcon, SealCheckIcon, Text, border, color, layout, radius, space } from '@/design';
import { Enter, FADE_MS, spring, useReduceMotion } from '@/motion';

/**
 * Coach feedback for a free-text drill. Rises from the bottom on the gentle
 * spring over a light scrim; the antelope hops when the attempt did what the
 * drill asked. The move is named in plain language, then observation,
 * strength, possible responses and one thing to try next.
 */
export function FeedbackPanel({ feedback, paused, actions }: { feedback: DrillFeedback; paused?: boolean; actions: ReactNode }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const mascot = useRef<MascotHandle>(null);
  const y = useSharedValue(reduce ? 0 : height);
  const o = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      o.value = withTiming(1, { duration: FADE_MS });
    } else {
      o.value = withTiming(1, { duration: 240 });
      y.value = withSpring(0, spring.gentle);
    }
    if (feedback.hitTarget) {
      const t = setTimeout(() => mascot.current?.hop(), 420);
      return () => clearTimeout(t);
    }
  }, [reduce, feedback.hitTarget, y, o]);

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: reduce ? o.value : 1 }));
  const scrim = useAnimatedStyle(() => ({ opacity: o.value }));

  const phrase = movePhrase(feedback.move);
  const headline = feedback.hitTarget ? `That’s ${phrase}.` : `That landed as ${phrase}.`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]} pointerEvents="none" />
      <Animated.View
        style={[styles.panel, { maxHeight: height * 0.8, paddingBottom: Math.max(insets.bottom, space[3]) + space[2] }, panel]}
        accessibilityViewIsModal
        accessibilityLabel="Coach feedback"
      >
        <View style={styles.handle} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Mascot ref={mascot} pose="head" size={64} paused={paused} accessibilityLabel="The antelope coach" />
            <View style={styles.headCopy}>
              <Chip
                label={feedback.hitTarget ? 'Did what the drill asked' : 'Worth another pass'}
                tone={feedback.hitTarget ? 'gold' : 'soft'}
                icon={feedback.hitTarget ? <SealCheckIcon size={14} weight="fill" color="#8A5A0B" /> : undefined}
              />
              <Text variant="heading" accessibilityRole="header" style={styles.headline}>
                {headline}
              </Text>
            </View>
          </View>

          <Enter index={1} delay={200}>
            <Text variant="body">{feedback.observation}</Text>
          </Enter>

          {feedback.strength ? (
            <Enter index={2} delay={200} style={styles.strength}>
              <SealCheckIcon size={20} weight="fill" color={color.gold} />
              <View style={styles.flex}>
                <Text variant="label">What worked</Text>
                <Text variant="body" color={color.ink}>
                  {feedback.strength}
                </Text>
              </View>
            </Enter>
          ) : null}

          {feedback.possibleResponses.map((r, i) => (
            <Enter key={i} index={3 + i} delay={200}>
              <PossibleResponse text={r} index={i} />
            </Enter>
          ))}

          <Enter index={3 + feedback.possibleResponses.length} delay={200} style={styles.tryNext}>
            <View style={styles.tryIcon}>
              <LightbulbIcon size={18} weight="fill" color={color.primary} />
            </View>
            <View style={styles.flex}>
              <Text variant="label" color={color.primaryShadow}>
                Try next
              </Text>
              <Text variant="body">{feedback.tryNext}</Text>
            </View>
          </Enter>
        </ScrollView>
        <View style={styles.actions}>{actions}</View>
      </Animated.View>
    </View>
  );
}

/** Quiet text action (secondary to the docked primary). */
export function QuietLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={styles.link}>
      <Text variant="label" color={color.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(10, 40, 78, 0.16)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.white,
    borderTopLeftRadius: radius.illustration,
    borderTopRightRadius: radius.illustration,
    borderWidth: border,
    borderBottomWidth: 0,
    borderColor: color.line,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: color.line, marginTop: space[3] },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: layout.gutter, paddingTop: space[4], paddingBottom: space[4], gap: space[4], width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  headCopy: { flex: 1, gap: space[2] },
  headline: {},
  strength: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  flex: { flex: 1 },
  tryNext: {
    flexDirection: 'row',
    gap: space[3],
    alignItems: 'flex-start',
    borderWidth: border,
    borderColor: color.primaryTint,
    borderRadius: radius.md,
    padding: space[4],
  },
  tryIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.soft, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: layout.gutter, paddingTop: space[3], gap: space[2], borderTopWidth: 2, borderTopColor: color.soft, width: '100%', maxWidth: layout.maxWidth + 40, alignSelf: 'center' },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
