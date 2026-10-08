import type Anthropic from "@anthropic-ai/sdk";
import type { ModelRole } from "@antelope/core";
import { getClient } from "./client";
import { ApiError } from "./http";
import { effortFor, modelFor } from "./models";

export interface StructuredCall {
  role: ModelRole;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
  label: string;
}

/**
 * One non-streaming Messages call constrained to a JSON schema
 * (output_config.format). Returns the parsed object (untrusted: callers
 * still validate semantics such as turn ids). The system prompt carries a
 * cache breakpoint so repeated calls for the same scenario hit the cache.
 */
export async function structuredCall<T>(call: StructuredCall): Promise<T> {
  const started = Date.now();
  const response = await getClient().messages.create(
    {
      model: modelFor(call.role),
      max_tokens: call.maxTokens,
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: call.user }],
      output_config: {
        effort: effortFor(call.role),
        format: { type: "json_schema", schema: call.schema },
      },
    },
    { timeout: call.timeoutMs, signal: call.signal },
  );

  logUsage(call.label, response.usage, Date.now() - started);

  if (response.stop_reason === "refusal") {
    throw new ApiError(502, "The AI could not complete this request.");
  }
  if (response.stop_reason === "max_tokens") {
    console.error(`[ai] ${call.label}: hit max_tokens (${call.maxTokens})`);
    throw new ApiError(502, "The AI response was cut off. Please try again.");
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`[ai] ${call.label}: model returned non-JSON output`);
    throw new ApiError(502, "The AI returned an unreadable response. Please try again.");
  }
}

export function logUsage(label: string, usage: Anthropic.Usage, ms: number): void {
  if (process.env.AI_LOG_USAGE === "0") return;
  console.log(
    `[ai] ${label} ${ms}ms in=${usage.input_tokens} cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0} out=${usage.output_tokens}`,
  );
}
