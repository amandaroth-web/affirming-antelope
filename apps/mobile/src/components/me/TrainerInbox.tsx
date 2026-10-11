import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Avatar, CaretRightIcon, Chip, ListRow, Raised, Text, color, space } from '@/design';
import { practiceTitle, sessionLabel, shortDate } from '@/data/practice';
import { useListLayout } from '@/motion';
import { personSeed, useAccount, type Review, type Submission } from '@/state/account';

/**
 * Me › From your trainer: every session the learner shared, newest first, with its
 * real state. A review not opened yet carries a "New" chip. Rows open the detail.
 */
export function TrainerInbox() {
  const submissions = useAccount((s) => s.submissions);
  const reviews = useAccount((s) => s.reviews);
  const cohorts = useAccount((s) => s.cohorts);
  const layout = useListLayout();

  if (!submissions.length) {
    return (
      <Raised contentStyle={styles.empty}>
        <Text variant="bodyStrong">Nothing shared yet</Text>
        <Text variant="caption" color={color.muted}>
          After a role-play, Submit for trainer review sends that one session here. Feedback lands here and on Home.
        </Text>
      </Raised>
    );
  }

  const rows = [...submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return (
    <Raised contentStyle={styles.list}>
      {rows.map((sub, i) => {
        const review = reviews.find((r) => r.submissionId === sub.id);
        const trainer = review?.trainerName ?? cohorts.find((c) => c.id === sub.cohortId)?.trainerName ?? 'Your trainer';
        return (
          <Animated.View key={sub.id} layout={layout}>
            <ListRow
              onPress={() =>
                router.push({
                  pathname: '/review/[id]',
                  params: { id: sub.id },
                })
              }
              last={i === rows.length - 1}
              accessibilityLabel={`${sessionLabel(sub.kind, sub.refId)}, ${stateLine(sub, review, trainer)}`}
            >
              <Avatar seed={personSeed(trainer)} size={40} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {practiceTitle(sub.kind, sub.refId)}
                </Text>
                <Text variant="caption" color={color.muted} numberOfLines={1}>
                  {stateLine(sub, review, trainer)}
                </Text>
              </View>
              {review && !review.learnerSeenAt ? <Chip label="New" tone="primary" /> : null}
              <CaretRightIcon size={18} weight="bold" color={color.faint} />
            </ListRow>
          </Animated.View>
        );
      })}
    </Raised>
  );
}

function stateLine(sub: Submission, review: Review | undefined, trainer: string): string {
  if (review) return `Reviewed by ${review.trainerName} · ${shortDate(review.createdAt)}`;
  if (sub.status === 'withdrawn') return `Withdrawn · ${shortDate(sub.submittedAt)}`;
  if (sub.local) return 'Waiting to send';
  return `With ${trainer} · shared ${shortDate(sub.submittedAt)}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: space[4] },
  empty: { padding: space[4], gap: space[1] },
});
