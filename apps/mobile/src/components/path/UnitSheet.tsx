import { getSkill, type ActivityKind, type PathUnit } from '@antelope/core';
import { StyleSheet, View } from 'react-native';
import {
  ArrowRightIcon,
  BookOpenTextIcon,
  BottomSheet,
  Button,
  ChatsCircleIcon,
  CheckIcon,
  Chip,
  LightningIcon,
  Text,
  color,
  radius,
  space,
} from '@/design';
import type { WeekStatus } from '@/state/store';

const KIND: Record<ActivityKind, { label: string; Icon: typeof LightningIcon }> = {
  learn: { label: 'Learn', Icon: BookOpenTextIcon },
  drill: { label: 'Drill', Icon: LightningIcon },
  roleplay: { label: 'Role-play', Icon: ChatsCircleIcon },
};

/**
 * The week's sheet. Keep passing the last `unit` while `open` goes false so the
 * content stays put as the sheet shrinks back into its node (`origin`).
 */
export function UnitSheet({
  unit,
  open = !!unit,
  origin,
  status,
  weeks,
  completed,
  onClose,
  onStart,
}: {
  unit: PathUnit | null;
  open?: boolean;
  /** Window centre of the tapped node; the sheet grows out of it. */
  origin?: { x: number; y: number };
  status: WeekStatus;
  /** Weeks in the active course ("Week 3 of 8"). */
  weeks?: number;
  completed: string[];
  onClose: () => void;
  onStart: (activityId: string) => void;
}) {
  const next = unit?.activities.find((a) => !completed.includes(a.id));
  const total = unit?.activities.reduce((n, a) => n + a.minutes, 0) ?? 0;
  return (
    <BottomSheet
      open={open && !!unit}
      onClose={onClose}
      origin={origin}
      originColor={status === 'complete' ? color.gold : color.primary}
      accessibilityLabel={unit ? `Week ${unit.week}${weeks ? ` of ${weeks}` : ''}, ${unit.title}` : undefined}
    >
      {unit ? (
        <View>
          <Text variant="overline" color={status === 'complete' ? color.goldInk : color.primaryShadow}>
            Week {unit.week} · {status === 'complete' ? 'Complete' : 'In progress'} · {total} min
          </Text>
          <Text variant="title" style={styles.title}>
            {unit.title}
          </Text>
          <Text variant="body" color={color.muted}>
            {unit.subtitle}
          </Text>
          <View style={styles.skills}>
            {unit.skills.map((s) => (
              <Chip key={s} label={getSkill(s).name} tone="soft" />
            ))}
          </View>

          <View style={styles.list}>
            {unit.activities.map((a, i) => {
              const done = completed.includes(a.id);
              const isNext = status === 'current' && a.id === next?.id;
              const { label, Icon } = KIND[a.kind];
              return (
                <View
                  key={a.id}
                  style={[styles.row, isNext && styles.rowNext, i < unit.activities.length - 1 && !isNext && styles.rule]}
                  accessible
                  accessibilityLabel={`${a.title}, ${label}, ${a.minutes} minutes${done ? ', done' : isNext ? ', up next' : ''}`}
                >
                  <View style={[styles.kind, done && styles.kindDone, isNext && styles.kindNext]}>
                    {done ? (
                      <CheckIcon size={18} weight="bold" color={color.navy} />
                    ) : (
                      <Icon size={20} weight="fill" color={isNext ? color.white : color.primary} />
                    )}
                  </View>
                  <View style={styles.copy}>
                    <Text variant="bodyStrong" color={done ? color.muted : color.ink} numberOfLines={2}>
                      {a.title}
                    </Text>
                    <Text variant="caption" color={color.muted}>
                      {label} · {a.minutes} min
                    </Text>
                  </View>
                  {isNext ? <Chip label="Up next" tone="primary" /> : null}
                </View>
              );
            })}
          </View>

          {status === 'current' && next ? (
            <Button
              label="Start"
              onPress={() => onStart(next.id)}
              fullWidth
              icon={<ArrowRightIcon size={20} weight="bold" color={color.white} />}
              accessibilityLabel={`Start ${next.title}`}
            />
          ) : (
            <Button
              variant="secondary"
              label="Practice this week again"
              onPress={() => onStart(unit.activities.find((a) => a.kind !== 'learn')?.id ?? unit.activities[0].id)}
              fullWidth
            />
          )}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space[1], marginBottom: space[1] },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[3] },
  list: { marginTop: space[4], marginBottom: space[5] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[2] },
  rowNext: { backgroundColor: color.soft, borderRadius: radius.md },
  rule: { borderBottomWidth: 2, borderBottomColor: color.soft },
  kind: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: color.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindDone: { backgroundColor: color.gold },
  kindNext: { backgroundColor: color.primary },
  copy: { flex: 1 },
});
