import type { DemoAssignmentItem, DemoTrainerAssignment } from '@antelope/core';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Avatar, CaretRightIcon, Callout, CheckIcon, Chip, ListRow, ProgressBar, Raised, StepBadge, Text, color, space } from '@/design';
import { FADE_MS, STAGGER, spring, useReduceMotion } from '@/motion';
import { useOnChange } from './motion';

const KIND: Record<DemoAssignmentItem['kind'], string> = { drill: 'Short practice', roleplay: 'AI role-play', learn: 'Lesson' };

/** The check pops first; the summary bar fills after it. */
const SEG_AFTER_CHECK = 220;

/**
 * What the trainer asked for this week. Each item opens directly.
 * An item that becomes done: its check pops in ochre and the row settles,
 * then its segment of the summary bar fills. Nothing changes height.
 */
export function AssignmentCard({
  assignment,
  onOpenItem,
}: {
  assignment: DemoTrainerAssignment;
  onOpenItem: (item: DemoAssignmentItem) => void;
}) {
  const done = assignment.items.filter((i) => i.done).length;
  const total = assignment.items.length;
  return (
    <Raised contentStyle={styles.face}>
      <View style={styles.head}>
        <Avatar seed="rosa-lin-trainer" size={44} accessibilityLabel={assignment.assignedBy.name} />
        <View style={styles.from}>
          <Text variant="label">From {assignment.assignedBy.name}</Text>
          <Text variant="caption" color={color.muted}>
            {assignment.assignedBy.role}
          </Text>
        </View>
        <Chip label={assignment.dueLabel} tone="gold" />
      </View>

      <Text variant="heading" style={styles.title}>
        {assignment.title}
      </Text>
      <Text variant="body" color={color.muted}>
        {assignment.summary}
      </Text>

      {assignment.note ? (
        <Callout dense style={styles.note}>
          <Text variant="bodySmall" color={color.ink}>
            “{assignment.note}”
          </Text>
        </Callout>
      ) : null}

      <ProgressBar
        fills={assignment.items.map((it) => (it.done ? 1 : 0))}
        tint={color.gold}
        delay={SEG_AFTER_CHECK}
        style={styles.bar}
        accessibilityLabel={`${done} of ${total} done`}
      />

      <View style={styles.items}>
        {assignment.items.map((it, i) => (
          <ItemRow key={it.refId + i} item={it} onPress={() => onOpenItem(it)} last={i === total - 1} />
        ))}
      </View>
    </Raised>
  );
}

function ItemRow({ item, onPress, last }: { item: DemoAssignmentItem; onPress: () => void; last: boolean }) {
  const reduce = useReduceMotion();
  const c = useSharedValue(item.done ? 1 : 0);
  const settle = useSharedValue(0);

  useOnChange(item.done, (_, next) => {
    if (!next || reduce) {
      c.value = withTiming(next ? 1 : 0, { duration: FADE_MS });
      return;
    }
    c.value = withDelay(STAGGER, withSpring(1, spring.bouncy));
    // the row gives a little as the check lands, then settles back
    settle.value = withDelay(STAGGER, withSequence(withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }), withSpring(0, spring.release)));
  });

  const ring = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, c.value) * 2) }));
  const tick = useAnimatedStyle(() => ({
    opacity: reduce ? c.value : Math.min(1, Math.max(0, c.value) * 3),
    transform: [{ scale: reduce ? 1 : Math.max(0, c.value) }, { rotate: `${reduce ? 0 : (1 - Math.min(1, c.value)) * -25}deg` }],
  }));
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.015 * settle.value }] }));

  return (
    <ListRow
      onPress={onPress}
      last={last}
      accessibilityLabel={`${item.title}, ${KIND[item.kind]}${item.done ? ', done' : ''}`}
      contentStyle={rowStyle}
    >
      <View style={styles.check}>
        <StepBadge shape="pill" state="letter" size={CHECK} style={styles.idle} />
        <Animated.View style={[StyleSheet.absoluteFill, ring]}>
          <StepBadge shape="pill" state="done" size={CHECK} glyph={null} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.tick, tick]}>
          <CheckIcon size={14} weight="bold" color={color.navy} />
        </Animated.View>
      </View>
      <View style={styles.itemCopy}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.title}
        </Text>
        <Text variant="caption" color={color.muted}>
          {KIND[item.kind]}
        </Text>
      </View>
      <CaretRightIcon size={18} weight="bold" color={color.faint} />
    </ListRow>
  );
}

/** The row's check is the dense 24pt StepBadge. */
const CHECK = 24;

const styles = StyleSheet.create({
  face: { padding: space[5] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  from: { flex: 1 },
  title: { marginTop: space[4], marginBottom: 2 },
  note: { marginTop: space[4], borderTopLeftRadius: 4 },
  bar: { marginTop: space[4] },
  items: { marginTop: space[2] },
  check: { width: CHECK, height: CHECK },
  idle: { borderColor: color.shadow },
  tick: { alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1 },
});
