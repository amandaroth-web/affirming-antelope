import { SKILLS } from '@antelope/core';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SectionHeader } from '@/components/common/SectionHeader';
import { SkillLadder } from '@/components/me/SkillLadder';
import {
  Avatar,
  CaretRightIcon,
  ChatsCircleIcon,
  Chip,
  FlagPennantIcon,
  Hoofprint,
  Raised,
  Screen,
  Switch,
  Text,
  color,
  space,
} from '@/design';
import { Enter, RollingNumber, usePressScale } from '@/motion';
import { TOTAL_WEEKS } from '@/state/selectors';
import { useLearner } from '@/state/store';

export default function Me() {
  const s = useLearner();
  const pending = s.reviews.filter((r) => r.status === 'pending').length;
  const weekLabel = s.currentWeek > TOTAL_WEEKS ? 'MI for Leaders · Complete' : `MI for Leaders · Week ${s.currentWeek} of ${TOTAL_WEEKS}`;

  return (
    <Screen>
      <Enter style={styles.profile}>
        <Avatar seed="amanda-demo-learner" size={72} accessibilityLabel="Amanda" />
        <View style={styles.profileCopy}>
          <Text variant="title" accessibilityRole="header">
            {s.firstName}
          </Text>
          <Text variant="caption" color={color.muted}>
            {s.role}
          </Text>
          <Chip label={weekLabel} tone="soft" style={styles.course} />
        </View>
      </Enter>

      <Enter index={1} style={styles.stats}>
        <Stat label="day streak" value={s.streak.days} icon={<Hoofprint size={22} tint={color.gold} rotate={-12} />} />
        <Stat label="scenarios done" value={s.scenariosCompleted} icon={<ChatsCircleIcon size={22} weight="fill" color={color.primary} />} />
        <Stat label="weekly goals hit" value={s.weeklyGoal.hitCount} icon={<FlagPennantIcon size={22} weight="fill" color={color.gold} />} />
      </Enter>

      <Enter index={2}>
        <SectionHeader title="Skill levels" />
        <Text variant="body" color={color.muted} style={styles.explain}>
          Each skill climbs six levels, from Recognize to Advanced. No scores, just what you can do.
        </Text>
        <Raised contentStyle={styles.list}>
          {SKILLS.map((sk, i) => (
            <SkillLadder key={sk.id} skill={sk} progress={s.skills[sk.id]} last={i === SKILLS.length - 1} />
          ))}
        </Raised>
      </Enter>

      <Enter index={3}>
        <SectionHeader title="Your trainer" />
        <Raised contentStyle={styles.trainer}>
          <Avatar seed="rosa-lin-trainer" size={52} accessibilityLabel={s.assignment.assignedBy.name} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{s.assignment.assignedBy.name}</Text>
            <Text variant="caption" color={color.muted}>
              {s.assignment.assignedBy.role} · reviews your role-plays
            </Text>
          </View>
          <Chip label={pending ? `${pending} in review` : 'Nothing waiting'} tone={pending ? 'gold' : 'neutral'} />
        </Raised>
      </Enter>

      <Enter index={4}>
        <SectionHeader title="Settings" />
        <Raised contentStyle={styles.settings}>
          <SettingRow title="Reduce motion" detail="Cross-fades instead of movement">
            <Switch
              accessibilityLabel="Reduce motion"
              value={s.settings.motion === 'reduce'}
              onChange={(v) => s.setSetting('motion', v ? 'reduce' : 'system')}
            />
          </SettingRow>
          <SettingRow title="Haptics" detail="Taps and ticks on supported phones" last>
            <Switch accessibilityLabel="Haptics" value={s.settings.haptics} onChange={(v) => s.setSetting('haptics', v)} />
          </SettingRow>
        </Raised>

        <Text variant="overline" color={color.muted} style={styles.demoLabel}>
          Demo
        </Text>
        <Raised contentStyle={styles.settings}>
          <LinkRow
            title="Preview the completed pathway"
            onPress={() => {
              s.previewPathwayComplete();
              router.navigate('/path');
            }}
          />
          <LinkRow title="Reset demo data" onPress={() => s.resetDemo()} last />
        </Raised>
      </Enter>
    </Screen>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Raised style={styles.stat} contentStyle={styles.statFace}>
      {icon}
      <RollingNumber value={value} variant="heading" delay={250} />
      <Text variant="caption" color={color.muted} numberOfLines={2}>
        {label}
      </Text>
    </Raised>
  );
}

function SettingRow({ title, detail, last, children }: { title: string; detail: string; last?: boolean; children: ReactNode }) {
  return (
    <View style={[styles.row, !last && styles.rule]}>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color={color.muted}>
          {detail}
        </Text>
      </View>
      {children}
    </View>
  );
}

function LinkRow({ title, onPress, last }: { title: string; onPress: () => void; last?: boolean }) {
  const press = usePressScale(0.98);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      style={[styles.row, !last && styles.rule]}
    >
      <Text variant="bodyStrong" color={color.primary} style={styles.flex}>
        {title}
      </Text>
      <CaretRightIcon size={18} weight="bold" color={color.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  profileCopy: { flex: 1 },
  course: { marginTop: space[2] },
  stats: { flexDirection: 'row', gap: space[3], marginTop: space[6] },
  stat: { flex: 1 },
  statFace: { padding: space[3], paddingVertical: space[4], gap: 2, alignItems: 'flex-start' },
  explain: { marginTop: -space[1], marginBottom: space[3] },
  list: { paddingHorizontal: space[4], paddingVertical: space[1] },
  trainer: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4] },
  flex: { flex: 1 },
  settings: { paddingHorizontal: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[3] },
  rule: { borderBottomWidth: 2, borderBottomColor: color.soft },
  demoLabel: { marginTop: space[6], marginBottom: space[2] },
});
