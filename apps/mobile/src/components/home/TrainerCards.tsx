import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Avatar, Button, CaretRightIcon, ChatTeardropTextIcon, PressableSurface, Raised, Text, TextLink, UsersThreeIcon, color, radius, space } from '@/design';
import { sessionLabel } from '@/data/practice';
import { FADE_MS, STAGGER, spring, useReduceMotion } from '@/motion';
import { RATING, personSeed, type Review, type Submission } from '@/state/account';

/**
 * Home's trainer moments: new feedback (the inbox card), the nudge to join a cohort
 * once signed in, and the one quiet sign-in prompt guests see.
 */

/**
 * "Dr. Rosa Lin left feedback on your PM-017 role-play." A raised card that opens
 * the review. On arrival the "New" pip pops in after the card has risen, then
 * breathes twice and rests (an authored, finite loop). Reduced motion: it's just there.
 */
export function FeedbackCard({ review, sub, more, onPress }: { review: Review; sub: Submission | undefined; more: number; onPress: () => void }) {
  const reduce = useReduceMotion();
  const pip = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      pip.value = withTiming(1, { duration: FADE_MS });
      return;
    }
    pip.value = withDelay(
      STAGGER * 6,
      withSequence(withSpring(1, spring.bouncy), withRepeat(withSequence(withTiming(1.25, { duration: 420 }), withTiming(1, { duration: 520 })), 2)),
    );
  }, [reduce, pip]);
  const pipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pip.value }],
    opacity: Math.min(1, pip.value * 2),
  }));

  const what = sub ? `your ${sessionLabel(sub.kind, sub.refId)}` : 'a session you shared';
  const level = review.rating ? RATING[review.rating].label : null;
  return (
    <PressableSurface
      onPress={onPress}
      tone="surface"
      edge={color.primary}
      shadow={color.primaryShadow}
      depth={5}
      radius={radius.surface}
      accessibilityLabel={`${review.trainerName} left feedback on ${what}${more ? `, and ${more} more` : ''}. Open it.`}
      contentStyle={styles.feedback}
    >
      <View>
        <Avatar seed={personSeed(review.trainerName)} size={48} />
        <Animated.View style={[styles.pip, pipStyle]} />
      </View>
      <View style={styles.flex}>
        <Text variant="overline" color={color.primaryShadow}>
          New from your trainer
        </Text>
        <Text variant="bodyStrong" style={styles.line}>
          {review.trainerName} left feedback on {what}
        </Text>
        <Text variant="caption" color={color.muted} numberOfLines={1}>
          {[level, review.audioPath ? 'Voice note' : null, more ? `+${more} more` : null].filter(Boolean).join(' · ') || 'Open to read it'}
        </Text>
      </View>
      <CaretRightIcon size={18} weight="bold" color={color.primary} />
    </PressableSurface>
  );
}

/** Signed in, no cohort yet: the one thing that unlocks assignments. */
export function JoinCohortCard({ onJoin }: { onJoin: () => void }) {
  return (
    <Raised contentStyle={styles.join}>
      <View style={styles.joinHead}>
        <View style={styles.icon}>
          <UsersThreeIcon size={24} weight="fill" color={color.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="subheading">Join your cohort</Text>
          <Text variant="caption" color={color.muted}>
            Got a code from your trainer? Add it and their assignments land here.
          </Text>
        </View>
      </View>
      <Button variant="secondary" size="md" label="Enter cohort code" fullWidth onPress={onJoin} style={styles.joinBtn} />
    </Raised>
  );
}

/**
 * Guests: there's no trainer yet, so no sample assignment either. An invitation to
 * join a cohort (sign in, then the code) instead of someone else's homework.
 */
export function GuestJoinCard({ onJoin }: { onJoin: () => void }) {
  return (
    <Raised contentStyle={styles.join}>
      <View style={styles.joinHead}>
        <View style={styles.icon}>
          <UsersThreeIcon size={24} weight="fill" color={color.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="subheading">Practicing with a trainer?</Text>
          <Text variant="caption" color={color.muted}>
            Join their cohort and your assignments and feedback show up here. Until then, every practice counts.
          </Text>
        </View>
      </View>
      <Button variant="secondary" size="md" label="Join a cohort" fullWidth onPress={onJoin} style={styles.joinBtn} />
    </Raised>
  );
}

/** In a cohort, nothing assigned right now. */
export function NothingAssigned({ trainerName }: { trainerName: string }) {
  return (
    <Raised contentStyle={styles.join}>
      <View style={styles.joinHead}>
        <View style={styles.icon}>
          <ChatTeardropTextIcon size={24} weight="fill" color={color.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="subheading">Nothing assigned right now</Text>
          <Text variant="caption" color={color.muted}>
            {trainerName}’s next assignment shows up here. Until then, any practice counts.
          </Text>
        </View>
      </View>
    </Raised>
  );
}

/** Guests: under the demo assignment, a quiet way in for anyone who has a code. */
export function GuestCohortPrompt({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.guest}>
      <Text variant="caption" color={color.muted} style={styles.flex}>
        A sample assignment
      </Text>
      <TextLink label="Have a cohort code? Sign in" onPress={onPress} caret />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
  },
  pip: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: color.primary,
    borderWidth: 2.5,
    borderColor: color.white,
  },
  line: { marginTop: 2 },
  join: { padding: space[4] },
  joinHead: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.badge,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtn: { marginTop: space[4] },
  guest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[2],
  },
});
