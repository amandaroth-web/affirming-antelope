import { DEMO_LEARNER, type DemoLearnerState, type DemoSkillProgress, type PathwayId, type SkillId } from '@antelope/core';
import { freshLearnerState, getPathway, isPathwayId } from '@/data/pathways';
import type { LearnerState, PathwayProgress, SyncedState } from './store';

/**
 * The shape of a learner's progress document, shared by the persisted store (v3)
 * and `learner_state` on the server.
 *
 *   v2 (one pathway)    { pathwayId, currentWeek, completedActivityIds, pathSeenWeek, ...global }
 *   v3 (multi-pathway)  { activePathwayId, pathwayChosenAt, progress: { [pathwayId]: { currentWeek,
 *                         completedActivityIds, pathSeenWeek } }, ...global }
 *
 * Streak, weekly goal, skills and counts stay global: a reflection is the same skill
 * with a patient or a direct report. Everything in here is pure.
 */

export const LEGACY_CHOSEN_AT = '2000-01-01T00:00:00.000Z';

/** Before any practice: the course starts at week 1. */
export function emptyProgress(): PathwayProgress {
  return { currentWeek: 1, completedActivityIds: [], pathSeenWeek: 1 };
}

/** A stable empty progress for selectors (never mutate). */
export const EMPTY_PROGRESS: PathwayProgress = Object.freeze({ currentWeek: 1, completedActivityIds: [], pathSeenWeek: 1 }) as PathwayProgress;

function progressFrom(d: DemoLearnerState): PathwayProgress {
  const pathway = getPathway(d.pathwayId);
  const completed = [
    ...pathway.units.filter((u) => d.completedUnitIds.includes(u.id)).flatMap((u) => u.activities.map((a) => a.id)),
    ...d.currentUnitCompletedActivityIds,
  ];
  return { currentWeek: d.currentWeek, completedActivityIds: completed, pathSeenWeek: d.currentWeek };
}

type Seeded = Omit<LearnerState, 'practiceLog' | 'sessions' | 'settings' | 'lastGreetedDay'>;

/** A brand-new learner on a track. `chosenAt` is null until they pick one in the welcome. */
export function freshSeed(pathwayId: PathwayId, chosenAt: string | null): Seeded {
  const d = freshLearnerState(pathwayId);
  return {
    firstName: '',
    role: '',
    activePathwayId: pathwayId,
    pathwayChosenAt: chosenAt,
    progress: { [pathwayId]: progressFrom({ ...d, currentWeek: Math.max(1, d.currentWeek) }) },
    skills: structuredClone(d.skills),
    streak: { days: d.streakDays, lastPracticeDay: null },
    weekDays: Array.from({ length: 7 }, () => false),
    weeklyGoal: { target: d.weeklyGoal.target, done: d.weeklyGoal.done, hitCount: 0 },
    scenariosCompleted: 0,
    assignment: null,
    demo: false,
  };
}

/** Amanda, the demo learner (Me › Demo, dev builds only). */
export function demoSeed(weekdayToday: number): Seeded {
  const d = DEMO_LEARNER;
  // Demo week: practiced Monday through yesterday; today is still open.
  const weekDays = Array.from({ length: 7 }, (_, i) => i < weekdayToday && i < d.weeklyGoal.done + 2);
  return {
    firstName: d.user.firstName,
    role: d.user.role,
    activePathwayId: 'mi-for-leaders',
    pathwayChosenAt: LEGACY_CHOSEN_AT,
    progress: { 'mi-for-leaders': progressFrom(d) },
    skills: structuredClone(d.skills),
    streak: { days: d.streakDays, lastPracticeDay: null },
    weekDays,
    weeklyGoal: { ...d.weeklyGoal, hitCount: 3 },
    scenariosCompleted: 4,
    assignment: structuredClone(d.trainerAssignment),
    demo: true,
  };
}

/**
 * The v2 seed nobody touched: every new install used to start as Amanda (week 4, a
 * 17-day streak, a sample assignment). Practising sets `lastPracticeDay`, so a seed
 * with no practice day, Amanda's name and her exact numbers was never used.
 */
export function isUntouchedLegacyDemo(raw: Record<string, unknown>): boolean {
  const streak = raw.streak as { days?: number; lastPracticeDay?: string | null } | undefined;
  const goal = raw.weeklyGoal as { done?: number } | undefined;
  return (
    raw.firstName === DEMO_LEARNER.user.firstName &&
    !!streak &&
    streak.days === DEMO_LEARNER.streakDays &&
    !streak.lastPracticeDay &&
    raw.currentWeek === DEMO_LEARNER.currentWeek &&
    raw.scenariosCompleted === 4 &&
    (goal?.done ?? DEMO_LEARNER.weeklyGoal.done) === DEMO_LEARNER.weeklyGoal.done
  );
}

const asProgress = (v: unknown): PathwayProgress | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Partial<PathwayProgress>;
  const week = typeof p.currentWeek === 'number' && p.currentWeek >= 1 ? p.currentWeek : 1;
  return {
    currentWeek: week,
    completedActivityIds: Array.isArray(p.completedActivityIds) ? p.completedActivityIds.filter((x): x is string => typeof x === 'string') : [],
    pathSeenWeek: typeof p.pathSeenWeek === 'number' ? p.pathSeenWeek : week,
  };
};

/**
 * Any stored document (v2 or v3, local or from the server) → the v3 synced fields it
 * carries. Missing fields stay missing (the caller fills them from a fallback). An
 * untouched v2 demo seed comes back as a fresh learner who hasn't chosen a track.
 */
export function upgradeDoc(raw: unknown): Partial<SyncedState> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  if (!('progress' in r) && isUntouchedLegacyDemo(r)) {
    const { firstName, role, activePathwayId, pathwayChosenAt, progress, skills, streak, weekDays, weeklyGoal, scenariosCompleted } = freshSeed(
      'mi-for-leaders',
      null,
    );
    return { firstName, role, activePathwayId, pathwayChosenAt, progress, skills, streak, weekDays, weeklyGoal, scenariosCompleted };
  }
  const out: Partial<SyncedState> = {};
  for (const k of ['firstName', 'role', 'skills', 'streak', 'weekDays', 'weeklyGoal', 'scenariosCompleted'] as const) {
    if (r[k] !== undefined && r[k] !== null) (out as Record<string, unknown>)[k] = r[k];
  }
  if (r.progress && typeof r.progress === 'object') {
    const progress: SyncedState['progress'] = {};
    for (const [id, v] of Object.entries(r.progress as Record<string, unknown>)) {
      const p = asProgress(v);
      if (isPathwayId(id) && p) progress[id] = p;
    }
    out.progress = progress;
    if (isPathwayId(r.activePathwayId)) out.activePathwayId = r.activePathwayId;
    if (typeof r.pathwayChosenAt === 'string' || r.pathwayChosenAt === null) out.pathwayChosenAt = r.pathwayChosenAt as string | null;
  } else if (typeof r.currentWeek === 'number') {
    // v2: one pathway's progress at the top level, and it was in use (so the track counts as chosen)
    const id: PathwayId = isPathwayId(r.pathwayId) ? r.pathwayId : 'mi-for-leaders';
    out.progress = { [id]: asProgress(r)! };
    out.activePathwayId = id;
    out.pathwayChosenAt = LEGACY_CHOSEN_AT;
  }
  return out;
}

/**
 * What goes to `learner_state`: the v3 document plus the v2 fields mirrored from MI for
 * Leaders, so an older app version on another device still sees its own course.
 */
export function toRemoteDoc(s: SyncedState): Record<string, unknown> {
  const leaders = s.progress['mi-for-leaders'] ?? EMPTY_PROGRESS;
  return {
    ...s,
    shape: 3,
    pathwayId: 'mi-for-leaders',
    currentWeek: leaders.currentWeek,
    completedActivityIds: leaders.completedActivityIds,
    pathSeenWeek: leaders.pathSeenWeek,
  };
}

export function mergeProgress(a: PathwayProgress | undefined, b: PathwayProgress | undefined): PathwayProgress {
  if (!a) return b ?? emptyProgress();
  if (!b) return a;
  return {
    currentWeek: Math.max(a.currentWeek, b.currentWeek),
    completedActivityIds: Array.from(new Set([...b.completedActivityIds, ...a.completedActivityIds])),
    pathSeenWeek: Math.max(a.pathSeenWeek, b.pathSeenWeek),
  };
}

/** Skill levels only climb. */
export function skillRank(p: DemoSkillProgress) {
  return p.status === 'locked' ? -1 : p.level * 1000 + p.percent;
}

export function fillSkills(
  base: Record<SkillId, DemoSkillProgress>,
  over: Partial<Record<SkillId, DemoSkillProgress>> | undefined,
): Record<SkillId, DemoSkillProgress> {
  return { ...base, ...(over ?? {}) };
}
