import Anthropic from "@anthropic-ai/sdk";
import { effortFor } from "../models";
import type { AiProvider, StreamTextRequest, StructuredRequest, StructuredResult, TextStream, TokenUsage } from "./types";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    // One SDK-level retry for 429/5xx/connection errors; per-call timeouts are
    // set at the call site so a retry cannot silently double a long wait.
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  }
  return client;
}

function usage(raw: unknown): TokenUsage {
  const u = (raw ?? {}) as Partial<Anthropic.Usage>;
  return {
    inputTokens: u.input_tokens ?? 0,
    cachedInputTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    reasoningTokens: 0, // folded into output_tokens; not reported separately
  };
}

function streamText(req: StreamTextRequest): TextStream {
  const stream = getClient().messages.stream(
    {
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: req.messages,
      output_config: { effort: effortFor(req.role) },
      // Sonnet 5.5 rejects thinking: disabled; between_tools is the "off" switch.
      // Short in-character replies do not benefit from deliberation and every
      // thinking token delays the first visible word.
      ...(req.model.startsWith("claude-sonnet-5-5") ? { thinking: { type: "between_tools" as const } } : {}),
    },
    { timeout: req.timeoutMs, signal: req.signal },
  );

  async function* deltas(): AsyncGenerator<string> {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
  }

  return {
    [Symbol.asyncIterator]: deltas,
    usage: async () => {
      const final = await stream.finalMessage().catch(() => null);
      return final ? usage(final.usage) : null;
    },
    abort: () => stream.controller.abort(),
  };
}

/**
 * One non-streaming Messages call constrained to a JSON schema
 * (output_config.format). The system prompt carries a cache breakpoint so
 * repeated calls for the same scenario hit the cache.
 */
async function structured(req: StructuredRequest): Promise<StructuredResult> {
  const response = await getClient().messages.create(
    {
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: req.user }],
      output_config: {
        effort: effortFor(req.role),
        format: { type: "json_schema", schema: req.schema },
      },
    },
    { timeout: req.timeoutMs, signal: req.signal },
  );
  const u = usage(response.usage);

  if (response.stop_reason === "refusal") return { outcome: "refusal", usage: u };
  if (response.stop_reason === "max_tokens") return { outcome: "truncated", usage: u };

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return { outcome: "ok", value: JSON.parse(text), usage: u };
  } catch {
    return { outcome: "invalid_json", usage: u };
  }
}

export const anthropicProvider: AiProvider = {
  id: "anthropic",
  keyName: "ANTHROPIC_API_KEY",
  hasKey: () => Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  streamText,
  structured,
  usage,
};
