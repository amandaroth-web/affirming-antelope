import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type ActivityKind,
  type DemoSkillProgress,
  type DemoTrainerAssignment,
  type Debrief,
  type DrillFeedback,
  type PathwayId,
  type SelfReflection,
  type SkillId,
  type SkillLevelNumber,
  type Turn,
} from '@antelope/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { findActivityIn, getPathway } from '@/data/pathways';
import { setPerson, track } from '@/lib/analytics';
import { isUuid, uuid } from '@/lib/uuid';
import { demoSeed, EMPTY_PROGRESS, emptyProgress, freshSeed, upgradeDoc } from './learnerDoc';

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

/** One pathway's place in its course. Kept per pathway, so switching tracks loses nothing. */
export interface PathwayProgress {
  /** 1..units, or units + 1 once the pathway is complete. */
  currentWeek: number;
  completedActivityIds: string[];
  /**
   * The week the Path screen last showed as current. When `currentWeek` moves
   * past it, Path plays the unlock choreography once and then marks it seen.
   */
  pathSeenWeek: number;
}

export type PathwayChoiceSource = 'onboarding' | 'me' | 'cohort';

export interface LearnerState {
  /** Only the demo learner has a local name; real learners are greeted by their account name. */
  firstName: string;
  role: string;
  /** The track Home, Path and Practice follow. */
  activePathwayId: PathwayId;
  /** When the learner last picked a track (ISO). null until the welcome's track step. */
  pathwayChosenAt: string | null;
  /** Course progress per pathway. */
  progress: Partial<Record<PathwayId, PathwayProgress>>;
  /** Global: a skill is the same skill in either setting. */
  skills: Record<SkillId, DemoSkillProgress>;
  streak: { days: number; lastPracticeDay: string | null };
  /** Monday-start: which days this week had practice. */
  weekDays: boolean[];
  weeklyGoal: { target: number; done: number; hitCount: number };
  scenariosCompleted: number;
  /** The sample trainer assignment. Demo learner only; real learners get theirs from a cohort. */
  assignment: DemoTrainerAssignment | null;
  /** Me › Demo › "Demo learner" (dev builds): Amanda's seeded state, for demos. Never synced. */
  demo: boolean;
  practiceLog: PracticeRecord[];
  /** Finished drill reps and role-plays (newest first), kept so they can sync and be sent for review. */
  sessions: PracticeSession[];
  settings: Settings;
  /** Day the mascot last waved on Home; it greets once per day. */
  lastGreetedDay: string | null;
}

export interface LearnerActions {
  /** Mark a path activity done in whichever pathway owns it. Advances that pathway's week when its unit is done. */
  completeActivity: (activityId: string) => void;
  /** Log any finished practice (drill, role-play, lesson). Updates streak, weekly goal, and skill progress. */
  recordPractice: (p: Omit<PracticeRecord, 'id' | 'at' | 'ownerId'> & { at?: string }) => PracticeRecord;
  /** Keep a finished drill rep or role-play. Returns it with its client id. */
  recordSession: (p: Omit<PracticeSession, 'id' | 'ownerId'>) => PracticeSession;
  /** After a guest migration: guest-made records now belong to this account. */
  claimRecords: (userId: string, completionIds: string[], sessionIds: string[]) => void;
  /** Replace the synced part of the state (sign-in adoption, merges from the server). */
  applySynced: (synced: SyncedState) => void;
  /** Pick (or switch) the active track. Progress on the other track stays where it was. */
  choosePathway: (id: PathwayId, source: PathwayChoiceSource) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  markGreeted: () => void;
  /** Path played the unlock for the current week. */
  markPathSeen: () => void;
  /** Dev: rewind `pathSeenWeek` one week so Path replays the latest unlock. */
  replayPathUnlock: () => void;
  /** Dev (Me › Demo): become Amanda, the seeded demo learner, or go back to a fresh start. */
  setDemo: (on: boolean) => void;
  /** Start over on the active track (keeps settings and the track choice). */
  resetProgress: () => void;
  previewPathwayComplete: () => void;
}

/**
 * The part of the store mirrored to `learner_state` so progress follows the account.
 * Practice history goes to its own tables; settings, greetings and the demo flag stay on the device.
 */
export const SYNCED_KEYS = [
  'firstName',
  'role',
  'activePathwayId',
  'pathwayChosenAt',
  'progress',
  'skills',
  'streak',
  'weekDays',
  'weeklyGoal',
  'scenariosCompleted',
] as const satisfies readonly (keyof LearnerState)[];
export type SyncedState = Pick<LearnerState, (typeof SYNCED_KEYS)[number]>;

export function syncedState(s: LearnerState): SyncedState {
  const out = {} as Record<string, unknown>;
  for (const k of SYNCED_KEYS) out[k] = s[k];
  return out as SyncedState;
}

/** The active pathway's progress (a stable empty object before the first practice). */
export function progressOf(s: Pick<LearnerState, 'progress' | 'activePathwayId'>, id: PathwayId = s.activePathwayId): PathwayProgress {
  return s.progress[id] ?? EMPTY_PROGRESS;
}

/** Who's signed in, if anyone. Set by the auth listener; new records are stamped with it. */
let currentOwner: string | undefined;
export function setRecordOwner(userId: string | undefined) {
  currentOwner = userId;
}

const LOCAL_DEFAULTS = (): Pick<LearnerState, 'practiceLog' | 'sessions' | 'settings' | 'lastGreetedDay'> => ({
  practiceLog: [],
  sessions: [],
  settings: { motion: 'system', haptics: true },
  lastGreetedDay: null,
});

/** A new install: a fresh learner who picks a track in the welcome (MI for Leaders until then). */
function seed(): LearnerState {
  return { ...freshSeed('mi-for-leaders', null), ...LOCAL_DEFAULTS() };
}

function bumpSkill(p: DemoSkillProgress | undefined, minutes: number): DemoSkillProgress {
  // practising a skill starts it, even before its week on the path
  const from: DemoSkillProgress = !p || p.status === 'locked' ? { level: 1, percent: 0, status: 'in-progress' } : p;
  let percent = from.percent + Math.max(6, Math.round(minutes * 2.5));
  let level = from.level;
  if (percent >= 100 && level < 6) {
    level = (level + 1) as SkillLevelNumber;
    percent -= 100;
  }
  return { level, percent: Math.min(percent, 100), status: 'in-progress' };
}

/** A skill the course has reached unlocks (level 1), so the ladder shows it as started. */
function unlockSkills(skills: LearnerState['skills'], ids: readonly SkillId[]): LearnerState['skills'] {
  let out = skills;
  for (const id of ids) {
    if (out[id]?.status === 'locked') out = { ...out, [id]: { ...out[id], status: 'in-progress' } };
  }
  return out;
}

export const useLearner = create<LearnerState & LearnerActions>()(
  persist(
    (set, get) => ({
      ...seed(),

      completeActivity: (activityId) =>
        set((s) => {
          const owner = findActivityIn(activityId);
          if (!owner) return s;
          const id = owner.pathway.id;
          const p = s.progress[id] ?? emptyProgress();
          if (p.completedActivityIds.includes(activityId)) return s;
          const completedActivityIds = [...p.completedActivityIds, activityId];
          const unit = owner.pathway.units.find((u) => u.week === p.currentWeek);
          const unitDone = !!unit && unit.activities.every((a) => completedActivityIds.includes(a.id));
          const currentWeek = unitDone ? p.currentWeek + 1 : p.currentWeek;
          const next = owner.pathway.units.find((u) => u.week === currentWeek);
          return {
            progress: { ...s.progress, [id]: { ...p, completedActivityIds, currentWeek } },
            skills: unitDone && next ? unlockSkills(s.skills, next.skills) : s.skills,
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
          const assignment = s.assignment && {
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
          pathway_id: before.activePathwayId,
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

      choosePathway: (id, source) => {
        set((s) => {
          const pathway = getPathway(id);
          const progress = s.progress[id] ? s.progress : { ...s.progress, [id]: emptyProgress() };
          const week = progress[id]!.currentWeek;
          const unit = pathway.units.find((u) => u.week === week);
          return {
            activePathwayId: id,
            pathwayChosenAt: new Date().toISOString(),
            progress,
            skills: unit ? unlockSkills(s.skills, unit.skills) : s.skills,
          };
        });
        track('pathway_chosen', { pathway_id: id, source });
        setPerson({ pathway_id: id });
      },

      setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
      markGreeted: () => set({ lastGreetedDay: today() }),
      markPathSeen: () =>
        set((s) => {
          const p = progressOf(s);
          if (p.pathSeenWeek === p.currentWeek) return s;
          return { progress: { ...s.progress, [s.activePathwayId]: { ...p, pathSeenWeek: p.currentWeek } } };
        }),
      replayPathUnlock: () =>
        set((s) => {
          const p = progressOf(s);
          if (p.currentWeek <= 1) return s;
          return { progress: { ...s.progress, [s.activePathwayId]: { ...p, pathSeenWeek: p.currentWeek - 1 } } };
        }),
      setDemo: (on) =>
        set((s) => {
          const keep = { settings: s.settings, lastGreetedDay: null, practiceLog: [], sessions: [] };
          if (on) return { ...demoSeed(weekdayIndex()), ...keep };
          return { ...freshSeed(s.activePathwayId, s.pathwayChosenAt ?? new Date().toISOString()), ...keep };
        }),
      resetProgress: () =>
        set((s) => ({
          ...(s.demo ? demoSeed(weekdayIndex()) : freshSeed(s.activePathwayId, s.pathwayChosenAt)),
          settings: s.settings,
          lastGreetedDay: null,
        })),
      previewPathwayComplete: () =>
        set((s) => {
          const pathway = getPathway(s.activePathwayId);
          const week = pathway.units.length + 1;
          return {
            progress: {
              ...s.progress,
              [s.activePathwayId]: {
                currentWeek: week,
                completedActivityIds: pathway.units.flatMap((u) => u.activities.map((a) => a.id)),
                pathSeenWeek: progressOf(s).pathSeenWeek,
              },
            },
          };
        }),
    }),
    {
      name: LEARNER_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persisted, from) => {
        const s = (persisted ?? {}) as Record<string, unknown> & Partial<LearnerState> & { reviews?: unknown };
        // v2 (accounts): every record gets a uuid client id; sessions replace the local-only review queue.
        if (from < 2) {
          s.practiceLog = (s.practiceLog ?? []).map((r) => (isUuid(r.id) ? r : { ...r, id: uuid() }));
          s.sessions = [];
          delete s.reviews;
        }
        // v3 (pathways): progress per pathway. An untouched demo seed (every install used to start
        // as Amanda) becomes a fresh learner who picks a track; real progress moves under its pathway.
        if (from < 3) {
          const up = upgradeDoc(s);
          const untouched = up.pathwayChosenAt === null;
          const fresh = freshSeed('mi-for-leaders', null);
          const next: LearnerState = {
            ...fresh,
            ...up,
            // the demo identity was never theirs: no "Amanda", no sample trainer assignment. Real
            // practice (streak, levels, the course) stays.
            firstName: '',
            role: '',
            skills: { ...fresh.skills, ...(up.skills ?? {}) },
            assignment: null,
            demo: false,
            practiceLog: s.practiceLog ?? [],
            sessions: s.sessions ?? [],
            settings: s.settings ?? LOCAL_DEFAULTS().settings,
            lastGreetedDay: untouched ? null : (s.lastGreetedDay ?? null),
          };
          return next as LearnerState & LearnerActions;
        }
        return s as unknown as LearnerState & LearnerActions;
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

/** The active track right now (for analytics and launchers outside React). */
export function activePathwayId(): PathwayId {
  return useLearner.getState().activePathwayId;
}
