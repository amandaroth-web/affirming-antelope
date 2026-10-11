import OpenAI from "openai";
import { openaiEffortFor, type OpenAIEffort } from "../models";
import { stripNulls, toOpenAIStrictSchema } from "./openai-schema";
import { ProviderError, type AiProvider, type StreamTextRequest, type StructuredRequest, type StructuredResult, type TextStream, type TokenUsage } from "./types";

// Responses API. Instructions go first and the conversation after it, so the
// system prompt plus earlier turns form a stable prefix that OpenAI's automatic
// prompt caching (1,024+ token prefixes) reuses on the next turn.
// store: false keeps transcripts out of OpenAI's 30-day response storage.

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    // Same policy as the Anthropic client: one retry, per-call timeouts.
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 });
  }
  return client;
}

function usage(raw: unknown): TokenUsage {
  const u = (raw ?? {}) as Partial<OpenAI.Responses.ResponseUsage>;
  const input = u.input_tokens ?? 0;
  const cached = u.input_tokens_details?.cached_tokens ?? 0;
  const written = u.input_tokens_details?.cache_write_tokens ?? 0;
  return {
    inputTokens: Math.max(0, input - cached - written),
    cachedInputTokens: cached,
    cacheWriteTokens: written,
    outputTokens: u.output_tokens ?? 0,
    reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

/** max_output_tokens includes reasoning, so leave room for it above the visible budget. */
function outputBudget(maxTokens: number, effort: OpenAIEffort): number {
  const headroom = { none: 0, minimal: 1000, low: 3000, medium: 8000, high: 16000, xhigh: 24000 }[effort];
  return maxTokens + headroom;
}

function streamText(req: StreamTextRequest): TextStream {
  const effort = openaiEffortFor(req.role);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  req.signal?.addEventListener("abort", onAbort, { once: true });

  let resolveUsage!: (u: TokenUsage | null) => void;
  const usagePromise = new Promise<TokenUsage | null>((r) => (resolveUsage = r));

  async function* deltas(): AsyncGenerator<string> {
    let finalUsage: TokenUsage | null = null;
    try {
      const stream = await getClient().responses.create(
        {
          model: req.model,
          instructions: req.system,
          input: req.messages.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: outputBudget(req.maxTokens, effort),
          reasoning: { effort },
          text: { verbosity: "low" },
          store: false,
          prompt_cache_key: req.cacheKey,
          stream: true,
        },
        { timeout: req.timeoutMs, signal: controller.signal },
      );
      for await (const event of stream) {
        switch (event.type) {
          case "response.output_text.delta":
            if (event.delta) yield event.delta;
            break;
          case "response.completed":
          case "response.incomplete":
            finalUsage = usage(event.response.usage);
            break;
          case "response.failed":
            finalUsage = usage(event.response.usage);
            throw new ProviderError(`OpenAI response failed: ${event.response.error?.code ?? "unknown"}`);
          case "error":
            throw new ProviderError(`OpenAI stream error: ${event.code ?? "unknown"}`);
        }
      }
    } finally {
      req.signal?.removeEventListener("abort", onAbort);
      resolveUsage(finalUsage);
    }
  }

  return {
    [Symbol.asyncIterator]: deltas,
    usage: () => usagePromise,
    abort: () => controller.abort(),
  };
}

async function structured(req: StructuredRequest): Promise<StructuredResult> {
  const effort = openaiEffortFor(req.role);
  const response = await getClient().responses.create(
    {
      model: req.model,
      instructions: req.system,
      input: [{ role: "user", content: req.user }],
      max_output_tokens: outputBudget(req.maxTokens, effort),
      reasoning: { effort },
      text: {
        format: {
          type: "json_schema",
          name: req.schemaName,
          schema: toOpenAIStrictSchema(req.schema),
          strict: true,
        },
      },
      store: false,
      prompt_cache_key: req.cacheKey,
    },
    { timeout: req.timeoutMs, signal: req.signal },
  );
  const u = usage(response.usage);

  if (response.status === "incomplete") {
    const reason = response.incomplete_details?.reason;
    return { outcome: reason === "content_filter" ? "refusal" : "truncated", usage: u };
  }
  const refused = response.output.some(
    (item) => item.type === "message" && item.content.some((c) => c.type === "refusal"),
  );
  if (refused) return { outcome: "refusal", usage: u };

  try {
    return { outcome: "ok", value: stripNulls(JSON.parse(response.output_text), req.schema), usage: u };
  } catch {
    return { outcome: "invalid_json", usage: u };
  }
}

export const openaiProvider: AiProvider = {
  id: "openai",
  keyName: "OPENAI_API_KEY",
  hasKey: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
  streamText,
  structured,
  usage,
};
