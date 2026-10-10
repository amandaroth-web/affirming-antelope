// DRAFT — pending trainer review
// Mock learner state for the demo user. All people are fictional.

import type { ActivityKind, SkillId, SkillLevelNumber } from "./types";

export type UnitStatus = "complete" | "in-progress" | "locked";

export interface DemoSkillProgress {
  level: SkillLevelNumber;
  /** Percent of the way through the current level, 0-100. */
  percent: number;
  status: UnitStatus;
}

export interface DemoAssignmentItem {
  kind: ActivityKind;
  title: string;
  refId: string;
  done: boolean;
}

export interface DemoTrainerAssignment {
  id: string;
  title: string;
  summary: string;
  unitId: string;
  assignedBy: { name: string; role: string };
  /** ISO date (local, no time). */
  dueDate: string;
  dueLabel: string;
  note?: string;
  items: DemoAssignmentItem[];
}

export interface DemoTodaysPractice {
  kind: ActivityKind;
  refId: string;
  title: string;
  skill: SkillId;
  minutes: number;
  /** Coach-voice line explaining why this practice today. */
  why: string;
}

export interface DemoLearnerState {
  user: { id: string; firstName: string; role: string; organization: string };
  pathwayId: string;
  currentWeek: number;
  currentUnitId: string;
  completedUnitIds: string[];
  /** Completed activity ids in the current unit. */
  currentUnitCompletedActivityIds: string[];
  skills: Record<SkillId, DemoSkillProgress>;
  streakDays: number;
  weeklyGoal: { target: number; done: number };
  trainerAssignment: DemoTrainerAssignment;
  todaysPractice: DemoTodaysPractice;
}

export const DEMO_LEARNER: DemoLearnerState = {
  user: {
    id: "demo-amanda",
    firstName: "Amanda",
    role: "Director of outpatient nursing",
    organization: "Riverbend Health (fictional)",
  },
  pathwayId: "mi-for-leaders",
  currentWeek: 4,
  currentUnitId: "u04-focusing",
  completedUnitIds: ["u01-foundations", "u02-spirit", "u03-engaging"],
  currentUnitCompletedActivityIds: ["u04-a1", "u04-a2", "u04-a3"],
  skills: {
    oars: { level: 2, percent: 100, status: "complete" },
    engaging: { level: 3, percent: 40, status: "in-progress" },
    focusing: { level: 2, percent: 72, status: "in-progress" },
    evoking: { level: 1, percent: 48, status: "in-progress" },
    "change-talk": { level: 1, percent: 30, status: "in-progress" },
    "sustain-talk": { level: 1, percent: 20, status: "in-progress" },
    leadership: { level: 1, percent: 60, status: "in-progress" },
    discord: { level: 1, percent: 0, status: "locked" },
    planning: { level: 1, percent: 0, status: "locked" },
    "full-conversation": { level: 1, percent: 0, status: "locked" },
  },
  streakDays: 17,
  weeklyGoal: { target: 5, done: 3 },
  trainerAssignment: {
    id: "assign-week5-evoking",
    title: "Week 5 Evoking",
    summary: "2 short practices + 1 AI role-play",
    unitId: "u05-evoking-1",
    assignedBy: { name: "Dr. Rosa Lin", role: "MI trainer" },
    dueDate: "2026-10-09",
    dueLabel: "Due Friday",
    note: "Listen for the moment Darnell's reasons start to shift. Bring one example to our group session.",
    items: [
      { kind: "drill", title: "Spot the change talk", refId: "drill-evoking-01", done: false },
      { kind: "drill", title: "Reflect it back", refId: "drill-evoking-03", done: false },
      { kind: "roleplay", title: "The reports are late again", refId: "PM-017", done: false },
    ],
  },
  todaysPractice: {
    kind: "drill",
    refId: "drill-evoking-05",
    title: "Responding to sustain talk",
    skill: "sustain-talk",
    minutes: 5,
    why: "One short drill on meeting pushback without arguing. It sets you up for this week's role-play.",
  },
};
