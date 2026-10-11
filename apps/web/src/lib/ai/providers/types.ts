import type { ChatMessage, ModelRole } from "@antelope/core";
import type { ProviderId } from "../models";

/**
 * Normalized token counts for one call. The three input buckets are disjoint,
 * so cost = uncached * input + cached * cache read + cacheWrite * cache write
 * + output * output (reasoning tokens are billed as output and included in it).
 */
export interface TokenUsage {
  /** Input billed at the full rate. */
  inputTokens: number;
  /** Input served from the prompt cache. */
  cachedInputTokens: number;
  /** Input written to the prompt cache (billed at the write rate). */
  cacheWriteTokens: number;
  outputTokens: number;
  /** Subset of outputTokens spent on reasoning, when the provider reports it. */
  reasoningTokens: number;
}

interface CallBase {
  role: ModelRole;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
  /**
   * Groups calls that share a prompt prefix (e.g. "observer:PM-017") so the
   * provider can route them to the same cache. Never contains user content.
   */
  cacheKey: string;
}

export interface StreamTextRequest extends CallBase {
  system: string;
  messages: ChatMessage[];
}

/** Text deltas of one streamed reply. */
export interface TextStream extends AsyncIterable<string> {
  /** Resolves after the stream ends; null if the provider never reported usage. */
  usage(): Promise<TokenUsage | null>;
  abort(): void;
}

export interface StructuredRequest extends CallBase {
  system: string;
  user: string;
  /** A core JSON schema (Anthropic dialect). Providers adapt it as needed. */
  schema: Record<string, unknown>;
  /** Short identifier for the schema, e.g. "observer". */
  schemaName: string;
}

export type StructuredOutcome = "ok" | "refusal" | "truncated" | "invalid_json";

export interface StructuredResult {
  outcome: StructuredOutcome;
  /** Parsed JSON in the core schema's shape (untrusted). Set when outcome is "ok". */
  value?: unknown;
  usage: TokenUsage;
}

export interface AiProvider {
  id: ProviderId;
  /** Streams a reply as text deltas (role-player). */
  streamText(req: StreamTextRequest): TextStream;
  /** One JSON-schema-constrained call (observer, coach, drill coach). */
  structured(req: StructuredRequest): Promise<StructuredResult>;
  /** Maps this SDK's usage object to TokenUsage. */
  usage(raw: unknown): TokenUsage;
  /** True when this provider's API key is configured. */
  hasKey(): boolean;
  keyName: string;
}

/** A provider-side failure with no SDK error class (e.g. a failed stream event). Maps to a 502. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
