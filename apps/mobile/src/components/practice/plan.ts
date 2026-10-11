import { SETTING_LABELS, type ScenarioSpec, type Setting, type SkillId } from '@antelope/core';
import { hasDrills } from '@/data/routes';
import { otherSetting, scenariosForSetting } from '@/data/pathways';

/**
 * What a setting can offer for a skill, and what "Start" does when it can't
 * offer the thing the learner asked for. Practice never dead-ends: it falls
 * back to the closest rep and says so.
 */

/** Short names for the toggle and captions. Never "employee" in a clinical view. */
export const SETTING_COPY: Record<Setting, { with: string; forWho: string; track: string; examples: string }> = {
  clinical: { with: 'With patients', forWho: 'for patients', track: 'patient practice', examples: 'clinic' },
  workplace: { with: 'With your team', forWho: 'for your team', track: 'leadership practice', examples: 'workplace' },
};

export function scenarioFits(s: ScenarioSpec, skill: SkillId): boolean {
  return s.primaryChallenge === skill || s.targetSkills.includes(skill);
}

export type Availability = 'both' | 'roleplay' | 'drill' | 'none';

export function availability(skill: SkillId, setting: Setting): Availability {
  const d = hasDrills(skill, setting);
  const r = scenariosForSetting(setting).some((s) => scenarioFits(s, skill));
  return d && r ? 'both' : r ? 'roleplay' : d ? 'drill' : 'none';
}

/** The quiet line on a tile when the setting can't do everything for that skill. */
export function tileNote(av: Availability, setting: Setting): string | undefined {
  if (av === 'roleplay') return 'Role-play only';
  if (av === 'drill') return 'Drills only';
  if (av === 'none') return `Coming soon ${SETTING_COPY[setting].forWho}`;
  return undefined;
}

export interface Plan {
  kind: 'drill' | 'roleplay';
  /** Which setting's content to draw from (the other one when this one has none). */
  setting: Setting;
  /** Short fragment for the dock when we had to improvise. */
  note?: string;
}

export function planFor(skill: SkillId, setting: Setting, wantDrill: boolean): Plan {
  const other = otherSetting(setting);
  const hasD = hasDrills(skill, setting);
  const hasR = scenariosForSetting(setting).some((s) => scenarioFits(s, skill));
  const borrowed = `using ${SETTING_COPY[other].examples} examples`;

  if (wantDrill) {
    if (hasD) return { kind: 'drill', setting };
    if (hasR) return { kind: 'roleplay', setting, note: 'no drill here yet' };
    if (hasDrills(skill, other)) return { kind: 'drill', setting: other, note: borrowed };
    if (scenariosForSetting(other).some((s) => scenarioFits(s, skill))) return { kind: 'roleplay', setting: other, note: borrowed };
    return { kind: 'drill', setting };
  }
  if (hasR) return { kind: 'roleplay', setting };
  if (scenariosForSetting(setting).length) return { kind: 'roleplay', setting, note: 'closest scenario' };
  if (scenariosForSetting(other).length) return { kind: 'roleplay', setting: other, note: borrowed };
  return { kind: 'roleplay', setting };
}

/** Why "Challenge me" is unavailable, or undefined when there's something to shuffle. */
export function challengeReason(pool: ScenarioSpec[], setting: Setting): string | undefined {
  return pool.length ? undefined : `No ${SETTING_LABELS[setting].counterpart} scenarios yet`;
}
