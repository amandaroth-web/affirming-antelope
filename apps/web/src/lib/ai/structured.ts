import type { ModelRole } from "@antelope/core";
import { ApiError } from "./http";
import { logUsage, resolveRole } from "./providers";

export interface StructuredCall {
  role: ModelRole;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  /** Short schema id sent to providers that name schemas, e.g. "observer". */
  schemaName: string;
  /** Groups calls sharing a system prompt for prompt caching, e.g. a scenario id. */
  cacheScope: string;
  maxTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
  label: string;
}

/**
 * One non-streaming call constrained to a JSON schema, on whichever provider
 * the role is configured for. Returns the parsed object (untrusted: callers
 * still validate semantics such as turn ids).
 */
export async function structuredCall<T>(call: StructuredCall): Promise<T> {
  const { provider, model } = resolveRole(call.role);
  const started = Date.now();
  const result = await provider.structured({
    role: call.role,
    model,
    system: call.system,
    user: call.user,
    schema: call.schema,
    schemaName: call.schemaName,
    maxTokens: call.maxTokens,
    timeoutMs: call.timeoutMs,
    signal: call.signal,
    cacheKey: `${call.role}:${call.cacheScope}`,
  });

  logUsage({ provider: provider.id, model, role: call.role, label: call.label, ms: Date.now() - started, usage: result.usage });

  switch (result.outcome) {
    case "ok":
      return result.value as T;
    case "refusal":
      throw new ApiError(502, "The AI could not complete this request.");
    case "truncated":
      console.error(`[ai] ${call.label}: hit the output token limit (${call.maxTokens})`);
      throw new ApiError(502, "The AI response was cut off. Please try again.");
    case "invalid_json":
      console.error(`[ai] ${call.label}: model returned non-JSON output`);
      throw new ApiError(502, "The AI returned an unreadable response. Please try again.");
  }
}
