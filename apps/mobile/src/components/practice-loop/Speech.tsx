import { forwardRef, useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Mascot, type MascotHandle, type MascotMood, type MascotPose } from '@/components/mascot';
import { Avatar, QuotesIcon, TargetIcon, Text, border, color, radius, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';

// ---------------------------------------------------------------------------
// Bubble entrance: rises from the speaker's side with a soft overshoot.
// ---------------------------------------------------------------------------

export function useBubbleEntrance(side: 'left' | 'right', delay = 0, skip = false) {
  const reduce = useReduceMotion();
  const p = useSharedValue(skip ? 1 : 0);
  useEffect(() => {
    if (skip) return;
    p.value = reduce
      ? withDelay(delay, withTiming(1, { duration: FADE_MS }))
      : withDelay(delay, withSpring(1, { damping: 15, stiffness: 210, mass: 0.8 }));
  }, [p, reduce, delay, skip]);
  return useAnimatedStyle(() => {
    const v = p.value;
    if (reduce) return { opacity: v };
    return {
      opacity: Math.min(1, v * 1.6),
      transform: [{ translateY: (1 - v) * 18 }, { translateX: (1 - v) * (side === 'left' ? -10 : 10) }, { scale: 0.88 + 0.12 * v }],
    };
  });
}

// ---------------------------------------------------------------------------
// Chat bubbles
// ---------------------------------------------------------------------------

/** The learner's words: cobalt, raised on deep cobalt, tail at bottom right. */
export function LearnerBubble({ text, compact, style }: { text: string; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.learnerWrap, style]}>
      <View style={[styles.learner, compact && styles.compact]}>
        <Text variant="body" color={color.white} style={compact ? styles.compactText : undefined} selectable>
          {text}
        </Text>
      </View>
    </View>
  );
}

/** The employee's words: white, raised, with the persona avatar. Children replace the text (typing dots). */
export function EmployeeBubble({
  text,
  seed,
  name,
  compact,
  showAvatar = true,
  children,
  style,
}: {
  text?: string;
  seed: string;
  name?: string;
  compact?: boolean;
  showAvatar?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.employeeRow, style]}>
      {showAvatar ? <Avatar seed={seed} size={compact ? 26 : 34} accessibilityLabel={name} /> : null}
      <View style={[styles.employee, compact && styles.compact]}>
        {children ?? (
          <Text variant="body" style={compact ? styles.compactText : undefined} selectable>
            {text}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Three dots that rise in turn: someone is about to speak. */
export function TypingDots({ tint = color.faint }: { tint?: string }) {
  return (
    <View style={styles.dots} accessible accessibilityLabel="Typing">
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i} tint={tint} />
      ))}
    </View>
  );
}

function Dot({ i, tint }: { i: number; tint: string }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    const up = withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) });
    const down = withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) });
    v.value = withDelay(i * 140, withRepeat(withSequence(up, down, withTiming(0, { duration: 360 })), -1));
    return () => cancelAnimation(v);
  }, [i, v]);
  const style = useAnimatedStyle(() =>
    reduce ? { opacity: 0.45 + 0.55 * v.value } : { opacity: 0.55 + 0.45 * v.value, transform: [{ translateY: -4 * v.value }] },
  );
  return <Animated.View style={[styles.dot, { backgroundColor: tint }, style]} />;
}

// ---------------------------------------------------------------------------
// Drill speech card: the line the learner responds to, entering with presence.
// ---------------------------------------------------------------------------

export function SpeechCard({ speaker, seed, line, context }: { speaker: string; seed: string; line: string; context?: string }) {
  const reduce = useReduceMotion();
  const avatar = useSharedValue(0);
  const bubble = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      avatar.value = withTiming(1, { duration: FADE_MS });
      bubble.value = withDelay(80, withTiming(1, { duration: FADE_MS }));
      return;
    }
    avatar.value = withDelay(60, withSpring(1, spring.bouncy));
    bubble.value = withDelay(220, withSpring(1, { damping: 14, stiffness: 190, mass: 0.9 }));
  }, [reduce, avatar, bubble]);

  const avatarStyle = useAnimatedStyle(() => (reduce ? { opacity: avatar.value } : { opacity: Math.min(1, avatar.value * 2), transform: [{ scale: 0.6 + 0.4 * avatar.value }] }));
  const bubbleStyle = useAnimatedStyle(() =>
    reduce
      ? { opacity: bubble.value }
      : { opacity: Math.min(1, bubble.value * 1.8), transform: [{ translateY: (1 - bubble.value) * 22 }, { scale: 0.9 + 0.1 * bubble.value }] },
  );

  return (
    <View accessible accessibilityLabel={`${speaker} says: ${line}`}>
      {context ? (
        <Text variant="caption" color={color.muted} style={styles.context}>
          {context}
        </Text>
      ) : null}
      <Animated.View style={[styles.speakerRow, avatarStyle]}>
        <Avatar seed={seed} size={44} />
        <Text variant="label" color={color.ink}>
          {speaker}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.speechWrap, { transformOrigin: '12% 0%' }, bubbleStyle]}>
        <View style={styles.speechTail} />
        <View style={styles.speech}>
          <Text variant="subheading" style={[styles.speechText, line.length > 120 && styles.speechLong]} maxScale={1.5}>
            “{line}”
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/** What to try. Long instructions wrap; the target glyph anchors it as "the task". */
export function InstructionChip({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.instruction, style]} accessibilityRole="text" accessibilityLabel={`Task: ${text}`}>
      <View style={styles.instructionIcon}>
        <TargetIcon size={16} weight="bold" color={color.white} />
      </View>
      <Text variant="label" color={color.primaryShadow} style={styles.instructionText}>
        {text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Coach voice: the antelope beside a speech bubble.
// ---------------------------------------------------------------------------

export const CoachSays = forwardRef<
  MascotHandle,
  {
    children: ReactNode;
    pose?: MascotPose;
    mood?: MascotMood;
    size?: number;
    paused?: boolean;
    style?: StyleProp<ViewStyle>;
  }
>(function CoachSays({ children, pose = 'head', mood = 'idle', size = 64, paused, style }, ref) {
  return (
    <View style={[styles.coach, style]}>
      <Mascot ref={ref} pose={pose} mood={mood} size={size} paused={paused} accessibilityLabel="The antelope coach" />
      <View style={styles.coachBubble}>
        <View style={styles.coachTail} />
        {typeof children === 'string' ? <Text variant="body">{children}</Text> : children}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// "One possible MI-consistent response" — never "the correct answer".
// ---------------------------------------------------------------------------

export function PossibleResponse({ text, index, style }: { text: string; index?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.possible, style]}>
      <View style={styles.possibleHead}>
        <QuotesIcon size={16} weight="fill" color={color.primary} />
        <Text variant="overline" color={color.primaryShadow}>
          {index !== undefined && index > 0 ? 'Another MI-consistent option' : 'One possible MI-consistent response'}
        </Text>
      </View>
      <Text variant="body" selectable>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  learnerWrap: { alignItems: 'flex-end' },
  learner: {
    maxWidth: '86%',
    backgroundColor: color.primary,
    borderRadius: radius.surface,
    borderBottomRightRadius: 6,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 3,
    borderBottomColor: color.primaryShadow,
  },
  employeeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  employee: {
    maxWidth: '82%',
    flexShrink: 1,
    backgroundColor: color.white,
    borderRadius: radius.surface,
    borderBottomLeftRadius: 6,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: 5,
    borderBottomColor: color.shadow,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  compact: { paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.md },
  compactText: { fontSize: 14, lineHeight: 19 },
  dots: { flexDirection: 'row', gap: 6, paddingVertical: 7, paddingHorizontal: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  context: { marginBottom: space[3] },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
  speechWrap: { paddingTop: 8 },
  speechTail: {
    position: 'absolute',
    top: 1,
    left: 16,
    width: 18,
    height: 18,
    backgroundColor: color.white,
    borderLeftWidth: border,
    borderTopWidth: border,
    borderColor: color.line,
    transform: [{ rotate: '45deg' }],
    borderTopLeftRadius: 4,
    zIndex: 2,
  },
  speech: {
    backgroundColor: color.white,
    borderRadius: radius.surface,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: 6,
    borderBottomColor: color.shadow,
    padding: space[5],
  },
  speechText: { fontSize: 20, lineHeight: 27 },
  speechLong: { fontSize: 17, lineHeight: 24 },
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: color.soft,
    borderRadius: radius.md,
    paddingVertical: space[3],
    paddingLeft: space[3],
    paddingRight: space[4],
  },
  instructionIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  instructionText: { flex: 1, fontSize: 15, lineHeight: 20 },
  coach: { flexDirection: 'row', alignItems: 'flex-end', gap: space[3] },
  coachBubble: {
    flex: 1,
    backgroundColor: color.white,
    borderRadius: radius.surface,
    borderBottomLeftRadius: 6,
    borderWidth: border,
    borderColor: color.line,
    borderBottomWidth: 5,
    borderBottomColor: color.shadow,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    marginBottom: 6,
  },
  coachTail: {},
  possible: { backgroundColor: color.soft, borderRadius: radius.md, padding: space[4], gap: space[2] },
  possibleHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
