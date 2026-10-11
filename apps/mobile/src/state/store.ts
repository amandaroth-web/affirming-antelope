import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEMO_LEARNER,
  MI_FOR_LEADERS,
  type ActivityKind,
  type DemoSkillProgress,
  type DemoTrainerAssignment,
  type Debrief,
  type DrillFeedback,
  type SelfReflection,
  type SkillId,
  type SkillLevelNumber,
  type Turn,
} from '@antelope/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { track } from '@/lib/analytics';
import { isUuid, uuid } from '@/lib/uuid';

export const LEARNER_KEY = 'antelope.learner.v1';

/**
 * Whether this device already had learner data before this launch (an existing
 * guest install, e.g. a tester's web link). Read before the store can write, so
 * the welcome screen only shows on a true first launch.
 */
export const hadLearnerData: Promise<boolean> = AsyncStorage.getItem(LEARNER_KEY)
  .then((v) => v != null)
  .catch(() => false);

/** Local calendar day, YYYY-MM-DD. */
export function today(d = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Monday-start index 0..6 of a date. */
export function weekdayIndex(d = new Date()): number {
  return (d.getDay() + 6) % 7;
}

export interface PracticeRecord {
  /** uuid, created on the device. Also the row's `client_id` in activity_completions. */
  id: string;
  kind: ActivityKind;
  skill?: SkillId;
  /** Drill id, ScenarioSpec id, or lesson id. */
  refId?: string;
  /** Path activity id when the practice came from the course. */
  activityId?: string;
  minutes: number;
  at: string; // ISO timestamp
  /** The account this was recorded under. Unset: made in guest mode, uploaded on first sign-in. */
  ownerId?: string;
}

/** A finished drill rep or role-play, as stored in practice_sessions. */
export interface PracticeSession {
  /** uuid, created on the device: both `client_id` and `id` of the practice_sessions row. */
  id: string;
  kind: 'roleplay' | 'drill';
  /** Drill id or ScenarioSpec id. */
  refId: string;
  skill?: SkillId;
  transcript: Turn[];
  /** Role-play: the AI debrief. Drill: the coach's feedback, or the multiple-choice picks. */
  debrief?: Debrief | DrillFeedback | { picks: string[]; hitTarget: boolean };
  selfReflection?: SelfReflection;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  ownerId?: string;
}

export interface Settings {
  /** 'system' follows the OS setting; 'reduce' forces cross-fades everywhere. */
  motion: 'system' | 'reduce';
  haptics: boolean;
}

export interface LearnerState {
  firstName: string;
  role: string;
  pathwayId: string;
  /** 1..12, or 13 once the pathway is complete. */
  currentWeek: number;
  completedActivityIds: string[];
  skills: Record<SkillId, DemoSkillProgress>;
  streak: { days: number; lastPracticeDay: string | null };
  /** Monday-start: which days this week had practice. */
  weekDays: boolean[];
  weeklyGoal: { target: number; done: number; hitCount: number };
  scenariosCompleted: number;
  assignment: DemoTrainerAssignment;
  practiceLog: PracticeRecord[];
  /** Finished drill reps and role-plays (newest first), kept so they can sync and be sent for review. */
  sessions: PracticeSession[];
  settings: Settings;
  /** Day the mascot last waved on Home; it greets once per day. */
  lastGreetedDay: string | null;
  /**
   * The week the Path screen last showed as current. When `currentWeek` moves
   * past it, Path plays the unlock choreography once and then marks it seen.
   */
  pathSeenWeek: number;
}

export interface LearnerActions {
  /** Mark a path activity done. Advances the week when every activity in the unit is done. */
  completeActivity: (activityId: string) => void;
  /** Log any finished practice (drill, role-play, lesson). Updates streak, weekly goal, and skill progress. */
  recordPractice: (p: Omit<PracticeRecord, 'id' | 'at' | 'ownerId'> & { at?: string }) => PracticeRecord;
  /** Keep a finished drill rep or role-play. Returns it with its client id. */
  recordSession: (p: Omit<PracticeSession, 'id' | 'ownerId'>) => PracticeSession;
  /** After a guest migration: guest-made records now belong to this account. */
  claimRecords: (userId: string, completionIds: string[], sessionIds: string[]) => void;
  /** Replace the synced part of the state (sign-in adoption, merges from the server). */
  applySynced: (synced: SyncedState) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  markGreeted: () => void;
  /** Path played the unlock for the current week. */
  markPathSeen: () => void;
  /** Dev: rewind `pathSeenWeek` one week so Path replays the latest unlock. */
  replayPathUnlock: () => void;
  /** Demo helpers (Me > Settings). */
  resetDemo: () => void;
  previewPathwayComplete: () => void;
}

/**
 * The part of the store mirrored to `learner_state` so progress follows the account.
 * Practice history goes to its own tables; settings and greetings stay on the device.
 */
export const SYNCED_KEYS = [
  'firstName',
  'role',
  'pathwayId',
  'currentWeek',
  'completedActivityIds',
  'skills',
  'streak',
  'weekDays',
  'weeklyGoal',
  'scenariosCompleted',
  'pathSeenWeek',
] as const satisfies readonly (keyof LearnerState)[];
export type SyncedState = Pick<LearnerState, (typeof SYNCED_KEYS)[number]>;

export function syncedState(s: LearnerState): SyncedState {
  const out = {} as Record<string, unknown>;
  for (const k of SYNCED_KEYS) out[k] = s[k];
  return out as SyncedState;
}

/** Who's signed in, if anyone. Set by the auth listener; new records are stamped with it. */
let currentOwner: string | undefined;
export function setRecordOwner(userId: string | undefined) {
  currentOwner = userId;
}

function seed(): LearnerState {
  const d = DEMO_LEARNER;
  const completed = [
    ...MI_FOR_LEADERS.units.filter((u) => d.completedUnitIds.includes(u.id)).flatMap((u) => u.activities.map((a) => a.id)),
    ...d.currentUnitCompletedActivityIds,
  ];
  // Demo week: practiced Monday through yesterday; today is still open.
  const todayIdx = weekdayIndex();
  const weekDays = Array.from({ length: 7 }, (_, i) => i < todayIdx && i < d.weeklyGoal.done + 2);
  return {
    firstName: d.user.firstName,
    role: d.user.role,
    pathwayId: d.pathwayId,
    currentWeek: d.currentWeek,
    completedActivityIds: completed,
    skills: structuredClone(d.skills),
    streak: { days: d.streakDays, lastPracticeDay: null },
    weekDays,
    weeklyGoal: { ...d.weeklyGoal, hitCount: 3 },
    scenariosCompleted: 4,
    assignment: structuredClone(d.trainerAssignment),
    practiceLog: [],
    sessions: [],
    settings: { motion: 'system', haptics: true },
    lastGreetedDay: null,
    pathSeenWeek: d.currentWeek,
  };
}

function bumpSkill(p: DemoSkillProgress, minutes: number): DemoSkillProgress {
  if (p.status === 'locked') return p;
  let percent = p.percent + Math.max(6, Math.round(minutes * 2.5));
  let level = p.level;
  if (percent >= 100 && level < 6) {
    level = (level + 1) as SkillLevelNumber;
    percent -= 100;
  }
  return { level, percent: Math.min(percent, 100), status: 'in-progress' };
}

export const useLearner = create<LearnerState & LearnerActions>()(
  persist(
    (set, get) => ({
      ...seed(),

      completeActivity: (activityId) =>
        set((s) => {
          if (s.completedActivityIds.includes(activityId)) return s;
          const completedActivityIds = [...s.completedActivityIds, activityId];
          const unit = MI_FOR_LEADERS.units.find((u) => u.week === s.currentWeek);
          const unitDone = unit?.activities.every((a) => completedActivityIds.includes(a.id));
          return {
            completedActivityIds,
            currentWeek: unitDone ? s.currentWeek + 1 : s.currentWeek,
          };
        }),

      recordPractice: (input) => {
        const record: PracticeRecord = { ...input, id: uuid(), at: input.at ?? new Date().toISOString(), ownerId: currentOwner };
        const before = get();
        set((s) => {
          const day = today();
          const firstToday = s.streak.lastPracticeDay !== day;
          const weekDays = [...s.weekDays];
          weekDays[weekdayIndex()] = true;
          const done = s.weeklyGoal.done + 1;
          const justHit = done === s.weeklyGoal.target;
          const assignment = {
            ...s.assignment,
            items: s.assignment.items.map((it) => (it.refId === input.refId ? { ...it, done: true } : it)),
          };
          return {
            practiceLog: [record, ...s.practiceLog].slice(0, 200),
            streak: firstToday ? { days: s.streak.days + 1, lastPracticeDay: day } : s.streak,
            weekDays,
            weeklyGoal: { ...s.weeklyGoal, done, hitCount: s.weeklyGoal.hitCount + (justHit ? 1 : 0) },
            scenariosCompleted: s.scenariosCompleted + (input.kind === 'roleplay' ? 1 : 0),
            skills: input.skill ? { ...s.skills, [input.skill]: bumpSkill(s.skills[input.skill], input.minutes) } : s.skills,
            assignment,
          };
        });
        if (input.activityId) get().completeActivity(input.activityId);
        // ids, enums and counts only
        track('practice_completed', {
          kind: input.kind === 'learn' ? 'lesson' : input.kind,
          ref_id: input.refId ?? '',
          ...(input.skill ? { skill: input.skill } : {}),
          minutes: input.minutes,
          ...(input.activityId ? { activity_id: input.activityId } : {}),
          in_course: !!input.activityId,
        });
        const after = get();
        if (after.streak.days > before.streak.days) track('streak_extended', { streak_days: after.streak.days });
        if (after.weeklyGoal.done === after.weeklyGoal.target && before.weeklyGoal.done !== before.weeklyGoal.target) {
          track('weekly_goal_hit', { target: after.weeklyGoal.target });
        }
        return record;
      },

      recordSession: (input) => {
        const session: PracticeSession = { ...input, id: uuid(), ownerId: currentOwner };
        set((s) => ({ sessions: [session, ...s.sessions].slice(0, 100) }));
        return session;
      },

      claimRecords: (userId, completionIds, sessionIds) =>
        set((s) => {
          const c = new Set(completionIds);
          const ss = new Set(sessionIds);
          return {
            practiceLog: s.practiceLog.map((r) => (c.has(r.id) && !r.ownerId ? { ...r, ownerId: userId } : r)),
            sessions: s.sessions.map((r) => (ss.has(r.id) && !r.ownerId ? { ...r, ownerId: userId } : r)),
          };
        }),

      applySynced: (synced) => set(synced),

      setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
      markGreeted: () => set({ lastGreetedDay: today() }),
      markPathSeen: () => set((s) => (s.pathSeenWeek === s.currentWeek ? s : { pathSeenWeek: s.currentWeek })),
      replayPathUnlock: () => set((s) => (s.currentWeek > 1 ? { pathSeenWeek: s.currentWeek - 1 } : s)),
      resetDemo: () => set(seed()),
      previewPathwayComplete: () =>
        set({
          currentWeek: MI_FOR_LEADERS.units.length + 1,
          completedActivityIds: MI_FOR_LEADERS.units.flatMap((u) => u.activities.map((a) => a.id)),
        }),
    }),
    {
      name: LEARNER_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      // v2 (accounts): every record gets a uuid client id; sessions replace the local-only review queue.
      migrate: (persisted, from) => {
        const s = (persisted ?? {}) as Partial<LearnerState> & { reviews?: unknown };
        if (from < 2) {
          s.practiceLog = (s.practiceLog ?? []).map((r) => (isUuid(r.id) ? r : { ...r, id: uuid() }));
          s.sessions = [];
          delete s.reviews;
        }
        return s as LearnerState & LearnerActions;
      },
    },
  ),
);

/** Week status for the path. */
export type WeekStatus = 'complete' | 'current' | 'locked';
export function weekStatus(week: number, currentWeek: number): WeekStatus {
  if (week < currentWeek) return 'complete';
  if (week === currentWeek) return 'current';
  return 'locked';
}
