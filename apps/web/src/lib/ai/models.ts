import { MODEL_ROLES, type ModelRole } from "@antelope/core";

const ENV_KEYS: Record<ModelRole, string> = {
  rolePlayer: "AI_MODEL_ROLEPLAYER",
  observer: "AI_MODEL_OBSERVER",
  coach: "AI_MODEL_COACH",
  drillCoach: "AI_MODEL_DRILL",
};

/** Model id for a role: env override first, then the core default. */
export function modelFor(role: ModelRole): string {
  const override = process.env[ENV_KEYS[role]]?.trim();
  return override || MODEL_ROLES[role];
}

export type Effort = "low" | "medium" | "high";

/**
 * Thinking depth per role. Opus 5.5 always thinks (default effort is medium),
 * so effort is the only latency lever for the structured calls.
 */
const DEFAULT_EFFORT: Record<ModelRole, Effort> = {
  rolePlayer: "low",
  observer: "low",
  coach: "medium",
  drillCoach: "low",
};

export function effortFor(role: ModelRole): Effort {
  const raw = process.env[`${ENV_KEYS[role]}_EFFORT`]?.trim();
  return raw === "low" || raw === "medium" || raw === "high" ? raw : DEFAULT_EFFORT[role];
}
