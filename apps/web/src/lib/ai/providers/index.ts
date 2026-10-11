import type { ModelRole } from "@antelope/core";
import { modelFor, providerFor, providersInUse, type ProviderId } from "../models";
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import type { AiProvider, TokenUsage } from "./types";

export type { AiProvider, TokenUsage } from "./types";

const PROVIDERS: Record<ProviderId, AiProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
};

export function getProvider(id: ProviderId): AiProvider {
  return PROVIDERS[id];
}

/** The provider and model a role runs on right now (env is read per call). */
export function resolveRole(role: ModelRole): { provider: AiProvider; model: string } {
  const id = providerFor(role);
  return { provider: PROVIDERS[id], model: modelFor(role, id) };
}

/** Providers in use whose API key is missing. */
export function missingKeys(): string[] {
  return providersInUse()
    .map((id) => PROVIDERS[id])
    .filter((p) => !p.hasKey())
    .map((p) => p.keyName);
}

export interface UsageLine {
  provider: ProviderId;
  model: string;
  role: ModelRole;
  label: string;
  ms: number;
  /** Time to the first streamed text, for streaming calls. */
  ttfbMs?: number;
  usage: TokenUsage | null;
}

/**
 * One line per AI call with counts and timings only: never prompt or reply
 * content. Format (stable, parsed by scripts/compare-providers.mjs):
 * [ai] usage label=... provider=... role=... model=... ms=... ttfb_ms=... in=... cached=... cache_write=... out=... reasoning=...
 */
export function logUsage(line: UsageLine): void {
  if (process.env.AI_LOG_USAGE === "0") return;
  const u = line.usage;
  const n = (v: number | undefined) => (u ? String(v ?? 0) : "?");
  console.log(
    `[ai] usage label=${line.label} provider=${line.provider} role=${line.role} model=${line.model} ms=${line.ms}` +
      ` ttfb_ms=${line.ttfbMs ?? "-"} in=${n(u?.inputTokens)} cached=${n(u?.cachedInputTokens)}` +
      ` cache_write=${n(u?.cacheWriteTokens)} out=${n(u?.outputTokens)} reasoning=${n(u?.reasoningTokens)}`,
  );
}
