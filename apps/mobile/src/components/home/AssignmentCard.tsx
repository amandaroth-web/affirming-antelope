import type { DemoAssignmentItem, DemoTrainerAssignment } from '@antelope/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, CaretRightIcon, CheckIcon, Chip, Raised, Text, color, radius, space } from '@/design';
import { usePressScale } from '@/motion';

const KIND: Record<DemoAssignmentItem['kind'], string> = { drill: 'Short practice', roleplay: 'AI role-play', learn: 'Lesson' };

/** What the trainer asked for this week. Each item opens directly. */
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
          <View key={i} style={[styles.seg, it.done && styles.segDone]} />
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

function ItemRow({ item, onPress, last }: { item: DemoAssignmentItem; onPress: () => void; last: boolean }) {
  const press = usePressScale(0.98);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${KIND[item.kind]}${item.done ? ', done' : ''}`}
      style={[styles.item, !last && styles.itemRule]}
    >
      <View style={[styles.check, item.done && styles.checkDone]}>
        {item.done ? <CheckIcon size={14} weight="bold" color={color.white} /> : null}
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
  seg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.line },
  segDone: { backgroundColor: color.gold },
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
  checkDone: { backgroundColor: color.gold, borderColor: color.goldShadow },
  itemCopy: { flex: 1 },
});
