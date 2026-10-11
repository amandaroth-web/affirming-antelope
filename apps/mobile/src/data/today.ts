import { DEMO_LEARNER, getDrill, getSkill, type DemoTodaysPractice, type PathwayId } from '@antelope/core';
import type { PracticeRecord } from '@/state/store';
import { dailyDrillOrder, getPathway } from './pathways';

/**
 * Home's "Today's practice": the next drill in the active track's daily order that the
 * learner hasn't done yet (once they've done them all, the one done longest ago). The
 * title comes from the course activity that uses the drill when there is one, so it
 * reads like the path ("Spot the open question"), else the skill ("Reflections drill").
 * The demo learner keeps her scripted card.
 */
export function todaysPractice(pathwayId: PathwayId, log: PracticeRecord[], demo: boolean): DemoTodaysPractice {
  if (demo && pathwayId === 'mi-for-leaders') return DEMO_LEARNER.todaysPractice;
  const order = dailyDrillOrder(pathwayId).filter((id) => !!getDrill(id));
  const last = new Map<string, string>();
  for (const r of log) if (r.kind === 'drill' && r.refId && !last.has(r.refId)) last.set(r.refId, r.at);
  const next = order.find((id) => !last.has(id)) ?? [...order].sort((a, b) => (last.get(a) ?? '').localeCompare(last.get(b) ?? ''))[0];
  const drill = next ? getDrill(next) : undefined;
  if (!drill) return DEMO_LEARNER.todaysPractice;

  const pathway = getPathway(pathwayId);
  let title = `${getSkill(drill.skill).name} drill`;
  let week: number | undefined;
  for (const u of pathway.units) {
    const a = u.activities.find((x) => x.kind === 'drill' && x.refIds?.includes(drill.id));
    if (a) {
      title = a.title;
      week = u.week;
      break;
    }
  }
  const first = last.size === 0;
  const why = first
    ? 'Your first rep. One short drill, then the coach shows you what landed.'
    : week
      ? `One short drill from week ${week} of the course. A few minutes keeps the skill warm.`
      : 'One short drill. A few minutes keeps the skill warm.';
  return { kind: 'drill', refId: drill.id, title, skill: drill.skill, minutes: drill.choices?.length ? 3 : 5, why };
}
