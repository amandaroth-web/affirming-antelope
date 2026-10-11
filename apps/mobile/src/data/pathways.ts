import {
  SETTING_LABELS,
  counterpartLabel,
  dailyDrillOrder,
  drillsForSetting,
  freshLearnerState,
  getPathway as corePathway,
  listPathways as corePathways,
  scenariosForSetting,
  type PathActivity,
  type Pathway,
  type PathwayId,
  type PathUnit,
  type Setting,
} from '@antelope/core';

/**
 * The app's one door to pathway content. Screens import from here, never from
 * MI_FOR_LEADERS directly, so every surface follows the learner's active track.
 */

export { dailyDrillOrder, drillsForSetting, freshLearnerState, scenariosForSetting, SETTING_LABELS, counterpartLabel };

export const PATHWAY_IDS: PathwayId[] = ['mi-for-clinicians', 'mi-for-leaders'];

export function isPathwayId(v: unknown): v is PathwayId {
  return v === 'mi-for-leaders' || v === 'mi-for-clinicians';
}

export function getPathway(id: PathwayId | string | null | undefined): Pathway {
  return corePathway(id);
}

export function listPathways(): Pathway[] {
  return corePathways();
}

/** The track that practises conversations in a setting. */
export function pathwayForSetting(setting: Setting): PathwayId {
  return setting === 'clinical' ? 'mi-for-clinicians' : 'mi-for-leaders';
}

export function otherSetting(setting: Setting): Setting {
  return setting === 'clinical' ? 'workplace' : 'clinical';
}

/** Any unit, whichever pathway it belongs to (ids are unique across pathways). */
export function getUnit(id: string): PathUnit | undefined {
  for (const p of listPathways()) {
    const u = p.units.find((x) => x.id === id);
    if (u) return u;
  }
  return undefined;
}

/** A path activity and the pathway that owns it. */
export function findActivityIn(activityId: string | undefined): { activity: PathActivity; unit: PathUnit; pathway: Pathway } | undefined {
  if (!activityId) return undefined;
  for (const pathway of listPathways()) {
    for (const unit of pathway.units) {
      const activity = unit.activities.find((a) => a.id === activityId);
      if (activity) return { activity, unit, pathway };
    }
  }
  return undefined;
}

/** "Patients" / "Your team": the short name a picker or switcher shows. */
export function trackName(id: PathwayId): string {
  return id === 'mi-for-clinicians' ? 'Patients' : 'Your team';
}
