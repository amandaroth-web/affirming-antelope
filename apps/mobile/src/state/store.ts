import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEMO_LEARNER,
  MI_FOR_LEADERS,
  type ActivityKind,
  type DemoSkillProgress,
  type DemoTrainerAssignment,
  type Debrief,
  type SelfReflection,
  type SkillId,
  type SkillLevelNumber,
  type Turn,
} from '@antelope/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  id: string;
  kind: ActivityKind;
  skill?: SkillId;
  /** Drill id, ScenarioSpec id, or lesson id. */
  refId?: string;
  /** Path activity id when the practice came from the course. */
  activityId?: string;
  minutes: number;
  at: string; // ISO timestamp
}

export interface ReviewSubmission {
  id: string;
  scenarioId: string;
  turns: Turn[];
  selfReflection?: SelfReflection;
  /** The AI debrief the learner saw, shared so the trainer reviews the same feedback. */
  debrief?: Debrief;
  note?: string;
  submittedAt: string;
  status: 'pending' | 'reviewed';
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
  reviews: ReviewSubmission[];
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
  recordPractice: (p: Omit<PracticeRecord, 'id' | 'at'> & { at?: string }) => PracticeRecord;
  /** Queue a role-play for the trainer. */
  submitForReview: (s: Omit<ReviewSubmission, 'id' | 'submittedAt' | 'status'>) => ReviewSubmission;
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

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

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
    reviews: [],
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
        const record: PracticeRecord = { ...input, id: uid(), at: input.at ?? new Date().toISOString() };
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
        return record;
      },

      submitForReview: (input) => {
        const sub: ReviewSubmission = { ...input, id: uid(), submittedAt: new Date().toISOString(), status: 'pending' };
        set((s) => ({ reviews: [sub, ...s.reviews] }));
        return sub;
      },

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
      name: 'antelope.learner.v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
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
