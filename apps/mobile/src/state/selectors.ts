import { MI_FOR_LEADERS, getSkill, type PathActivity, type PathUnit, type SkillId } from '@antelope/core';
import { useLearner } from './store';

export const TOTAL_WEEKS = MI_FOR_LEADERS.units.length;

export function useCurrentUnit(): PathUnit | undefined {
  const week = useLearner((s) => s.currentWeek);
  return MI_FOR_LEADERS.units.find((u) => u.week === week);
}

/** First activity in a unit the learner hasn't finished. */
export function nextActivity(unit: PathUnit, completed: string[]): PathActivity | undefined {
  return unit.activities.find((a) => !completed.includes(a.id));
}

export interface ProgressRow {
  key: string;
  label: string;
  skill: SkillId;
  status: 'complete' | 'in-progress' | 'locked';
}

/**
 * Home's "Your progress": the course's core processes. A process is done when
 * its unit is complete; otherwise it shows the skill's level (no percentages).
 */
export function useProgressRows(): ProgressRow[] {
  const skills = useLearner((s) => s.skills);
  const week = useLearner((s) => s.currentWeek);
  const rows: { key: string; label: string; skill: SkillId; unitWeek: number }[] = [
    { key: 'foundations', label: 'Foundations', skill: 'oars', unitWeek: 1 },
    { key: 'engaging', label: getSkill('engaging').name, skill: 'engaging', unitWeek: 3 },
    { key: 'focusing', label: getSkill('focusing').name, skill: 'focusing', unitWeek: 4 },
    { key: 'evoking', label: getSkill('evoking').name, skill: 'evoking', unitWeek: 6 },
    { key: 'planning', label: getSkill('planning').name, skill: 'planning', unitWeek: 7 },
  ];
  return rows.map((r) => {
    const p = skills[r.skill];
    const status = r.unitWeek < week ? 'complete' : p.status === 'locked' ? 'locked' : 'in-progress';
    return { key: r.key, label: r.label, skill: r.skill, status };
  });
}
