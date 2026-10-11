import { MODEL_ROLES, type ModelRole } from "@antelope/core";

/**
 * Which AI provider, model and reasoning effort each role uses.
 *
 * Provider: AI_PROVIDER_<ROLE> overrides AI_PROVIDER, which defaults to
 * "anthropic". ROLE is ROLEPLAYER, OBSERVER, COACH or DRILL.
 *
 * Models are per provider so flipping AI_PROVIDER never sends a Claude model id
 * to OpenAI or the other way round:
 *   anthropic: AI_ANTHROPIC_MODEL_<ROLE>, else the older AI_MODEL_<ROLE>, else MODEL_ROLES (core)
 *   openai:    AI_OPENAI_MODEL_<ROLE>, else OPENAI_MODEL_ROLES below
 * Effort: the same names with an _EFFORT suffix (AI_MODEL_<ROLE>_EFFORT for Anthropic).
 */
export type ProviderId = "anthropic" | "openai";

const ROLE_ENV: Record<ModelRole, string> = {
  rolePlayer: "ROLEPLAYER",
  observer: "OBSERVER",
  coach: "COACH",
  drillCoach: "DRILL",
};

export const ALL_ROLES = Object.keys(ROLE_ENV) as ModelRole[];

/**
 * OpenAI defaults (October 2026 lineup, standard tier). See
 * docs/ai-provider-comparison.md for the measurements behind these.
 * - rolePlayer: Luna with no reasoning, for the fastest first word on short replies.
 * - observer: 6.1 Sol, low effort. Coding accuracy needs the mid model.
 * - coach: 6.1 Sol, medium effort. Astra costs more than Claude Opus, so it isn't a saving.
 * - drillCoach: Luna, low effort. One short response at a time.
 */
export const OPENAI_MODEL_ROLES: Record<ModelRole, string> = {
  rolePlayer: "gpt-6-luna",
  observer: "gpt-6.1-sol",
  coach: "gpt-6.1-sol",
  drillCoach: "gpt-6-luna",
};

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.error(message);
}

function parseProvider(name: string): ProviderId | undefined {
  const raw = env(name)?.toLowerCase();
  if (!raw) return undefined;
  if (raw === "anthropic" || raw === "openai") return raw;
  warnOnce(name, `[ai] ${name}="${raw}" is not anthropic or openai; ignoring it.`);
  return undefined;
}

export function providerFor(role: ModelRole): ProviderId {
  return parseProvider(`AI_PROVIDER_${ROLE_ENV[role]}`) ?? parseProvider("AI_PROVIDER") ?? "anthropic";
}

/** Providers that at least one role currently uses. */
export function providersInUse(): ProviderId[] {
  return [...new Set(ALL_ROLES.map(providerFor))];
}

/** Model id for a role on its provider (or on the provider given). */
export function modelFor(role: ModelRole, provider: ProviderId = providerFor(role)): string {
  const r = ROLE_ENV[role];
  if (provider === "openai") return env(`AI_OPENAI_MODEL_${r}`) ?? OPENAI_MODEL_ROLES[role];
  return env(`AI_ANTHROPIC_MODEL_${r}`) ?? env(`AI_MODEL_${r}`) ?? MODEL_ROLES[role];
}

export type Effort = "low" | "medium" | "high";

/**
 * Anthropic thinking depth per role. Opus 5.5 always thinks (default effort is
 * medium), so effort is the only latency lever for the structured calls.
 */
const DEFAULT_EFFORT: Record<ModelRole, Effort> = {
  rolePlayer: "low",
  observer: "low",
  coach: "low", // measured: ~12s -> ~8s on a 6-turn debrief, same copy quality
  drillCoach: "low",
};

export function effortFor(role: ModelRole): Effort {
  const r = ROLE_ENV[role];
  const raw = env(`AI_ANTHROPIC_MODEL_${r}_EFFORT`) ?? env(`AI_MODEL_${r}_EFFORT`);
  return raw === "low" || raw === "medium" || raw === "high" ? raw : DEFAULT_EFFORT[role];
}

export type OpenAIEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
const OPENAI_EFFORTS: OpenAIEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh"];

/**
 * OpenAI reasoning effort per role. GPT-6 models are all reasoning models;
 * Luna and 6 Sol accept "none", 6.1 Sol and Astra start at "low".
 */
const OPENAI_DEFAULT_EFFORT: Record<ModelRole, OpenAIEffort> = {
  rolePlayer: "none",
  observer: "low",
  coach: "medium",
  drillCoach: "low",
};

export function openaiEffortFor(role: ModelRole): OpenAIEffort {
  const raw = env(`AI_OPENAI_MODEL_${ROLE_ENV[role]}_EFFORT`)?.toLowerCase();
  return OPENAI_EFFORTS.includes(raw as OpenAIEffort) ? (raw as OpenAIEffort) : OPENAI_DEFAULT_EFFORT[role];
}
