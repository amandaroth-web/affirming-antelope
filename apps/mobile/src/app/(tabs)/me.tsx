import { SKILLS } from '@antelope/core';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SectionHeader } from '@/components/common/SectionHeader';
import { AccountSection, ProfileHead } from '@/components/me/AccountSection';
import { SkillLadder } from '@/components/me/SkillLadder';
import { TrainerInbox } from '@/components/me/TrainerInbox';
import { isSimulatedOffline, setSimulatedOffline, supabaseConfigured } from '@/lib/supabase';
import { syncNow } from '@/sync/engine';
import { personSeed, useAccount } from '@/state/account';
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
  const signedIn = useAccount((a) => a.status === 'signed-in');
  const cohorts = useAccount((a) => a.cohorts);
  const pending = useAccount((a) => a.submissions.filter((x) => x.status === 'submitted').length);
  const weekLabel = s.currentWeek > TOTAL_WEEKS ? 'MI for Leaders · Complete' : `MI for Leaders · Week ${s.currentWeek} of ${TOTAL_WEEKS}`;
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  }, []);
  const trainer = signedIn ? cohorts[0] : null;
  const showTrainer = !signedIn || !!trainer;

  return (
    <Screen refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary} /> : undefined}>
      <Enter>
        {signedIn ? (
          <ProfileHead courseChip={<Chip label={weekLabel} tone="soft" style={styles.course} />} />
        ) : (
          <View style={styles.profile}>
            <Avatar seed="amanda-demo-learner" size={72} accessibilityLabel={s.firstName} />
            <View style={styles.profileCopy}>
              <Text variant="title" accessibilityRole="header">
                {s.firstName}
              </Text>
              <Text variant="caption" color={color.muted}>
                {s.role}
              </Text>
              <Chip label={weekLabel} tone="soft" style={styles.course} />
            </View>
          </View>
        )}
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

      {signedIn ? (
        <Enter index={3}>
          <SectionHeader title="From your trainer" />
          <TrainerInbox />
        </Enter>
      ) : null}

      {showTrainer ? (
        <Enter index={3}>
          <SectionHeader title="Your trainer" />
          <Raised contentStyle={styles.trainer}>
            <Avatar
              seed={trainer ? personSeed(trainer.trainerName) : 'rosa-lin-trainer'}
              size={52}
              accessibilityLabel={trainer?.trainerName ?? s.assignment.assignedBy.name}
            />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{trainer?.trainerName ?? s.assignment.assignedBy.name}</Text>
              <Text variant="caption" color={color.muted} numberOfLines={2}>
                {trainer ? `${trainer.name} · reviews what you share` : `${s.assignment.assignedBy.role} · reviews your role-plays`}
              </Text>
            </View>
            {signedIn ? (
              <Chip label={pending ? `${pending} in review` : 'Nothing waiting'} tone={pending ? 'primary' : 'neutral'} />
            ) : (
              <Chip label="Sample" tone="neutral" />
            )}
          </Raised>
        </Enter>
      ) : null}

      {supabaseConfigured ? (
        <Enter index={4}>
          <SectionHeader title="Account" />
          <AccountSection />
        </Enter>
      ) : null}

      <Enter index={5}>
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

        {/* signed in, progress lives on the account, so the demo tools are dev-only there */}
        {signedIn && !__DEV__ ? null : (
          <>
            <Text variant="overline" color={color.muted} style={styles.demoLabel}>
              Demo
            </Text>
            <Raised contentStyle={styles.settings}>
              {__DEV__ && supabaseConfigured ? <OfflineToggle /> : null}
              <LinkRow
                title="Preview the completed pathway"
                onPress={() => {
                  s.previewPathwayComplete();
                  router.navigate('/path');
                }}
              />
              {__DEV__ ? (
                <LinkRow
                  title="Replay path unlock"
                  onPress={() => {
                    s.replayPathUnlock();
                    router.navigate('/path');
                  }}
                />
              ) : null}
              {/* a local reset would just sync back from the account */}
              {signedIn ? null : <LinkRow title="Reset demo data" onPress={() => s.resetDemo()} last />}
            </Raised>
          </>
        )}
      </Enter>
    </Screen>
  );
}

/** Dev only: make every Supabase request fail like a dropped connection, to watch the outbox work. */
function OfflineToggle() {
  const [on, setOn] = useState(isSimulatedOffline());
  useEffect(() => setOn(isSimulatedOffline()), []);
  return (
    <SettingRow title="Simulate offline" detail="Supabase requests fail until you turn this off">
      <Switch
        accessibilityLabel="Simulate offline"
        value={on}
        onChange={(v) => {
          setSimulatedOffline(v);
          setOn(v);
        }}
      />
    </SettingRow>
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
