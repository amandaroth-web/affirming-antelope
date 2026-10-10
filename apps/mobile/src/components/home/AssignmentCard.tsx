import type { DemoAssignmentItem, DemoTrainerAssignment } from '@antelope/core';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Avatar, CaretRightIcon, CheckIcon, Chip, Raised, Text, color, radius, space } from '@/design';
import { FADE_MS, STAGGER, spring, usePressScale, useReduceMotion } from '@/motion';
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
        <View style={styles.note}>
          <Text variant="body" color={color.ink} style={styles.noteText}>
            “{assignment.note}”
          </Text>
        </View>
      ) : null}

      <View style={styles.bar} accessible accessibilityLabel={`${done} of ${total} done`}>
        {assignment.items.map((it, i) => (
          <Segment key={i} done={it.done} />
        ))}
      </View>

      <View style={styles.items}>
        {assignment.items.map((it, i) => (
          <ItemRow key={it.refId + i} item={it} onPress={() => onOpenItem(it)} last={i === total - 1} />
        ))}
      </View>
    </Raised>
  );
}

function Segment({ done }: { done: boolean }) {
  const reduce = useReduceMotion();
  const p = useSharedValue(done ? 1 : 0);
  useOnChange(done, (_, next) => {
    const to = next ? 1 : 0;
    p.value = reduce ? withTiming(to, { duration: FADE_MS }) : withDelay(next ? SEG_AFTER_CHECK : 0, withSpring(to, spring.settle));
  });
  // reduced motion: the fill cross-fades in at full width instead of growing
  const fill = useAnimatedStyle(() => ({
    width: `${(reduce ? 1 : Math.max(0, Math.min(1, p.value))) * 100}%` as `${number}%`,
    opacity: reduce ? p.value : 1,
  }));
  return (
    <View style={styles.seg}>
      <Animated.View style={[styles.segFill, fill]} />
    </View>
  );
}

function ItemRow({ item, onPress, last }: { item: DemoAssignmentItem; onPress: () => void; last: boolean }) {
  const reduce = useReduceMotion();
  const press = usePressScale(0.98);
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
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${KIND[item.kind]}${item.done ? ', done' : ''}`}
      style={[!last && styles.itemRule]}
    >
      <Animated.View style={press.style}>
        <Animated.View style={[styles.item, rowStyle]}>
          <View style={styles.check}>
            <Animated.View style={[styles.checkFill, ring]} />
            <Animated.View style={tick}>
              <CheckIcon size={14} weight="bold" color={color.white} />
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
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: { padding: space[5] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  from: { flex: 1 },
  title: { marginTop: space[4], marginBottom: 2 },
  note: {
    marginTop: space[4],
    backgroundColor: color.soft,
    borderRadius: radius.md,
    borderTopLeftRadius: 4,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  noteText: { fontSize: 15, lineHeight: 21 },
  bar: { flexDirection: 'row', gap: 6, marginTop: space[4] },
  seg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.line, overflow: 'hidden' },
  segFill: { height: '100%', borderRadius: 4, backgroundColor: color.gold },
  items: { marginTop: space[2] },
  item: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingVertical: space[2] },
  itemRule: { borderBottomWidth: 2, borderBottomColor: color.soft },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: color.shadow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // covers the idle ring exactly (sits over the 2pt border)
  checkFill: {
    position: 'absolute',
    left: -2,
    top: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: color.gold,
    borderColor: color.goldShadow,
  },
  itemCopy: { flex: 1 },
});
