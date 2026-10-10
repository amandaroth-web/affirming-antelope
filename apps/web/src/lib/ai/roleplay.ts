import type Anthropic from "@anthropic-ai/sdk";
import { rolePlayerMessages, rolePlayerSystemPrompt, type ScenarioSpec, type Turn } from "@antelope/core";
import { getClient } from "./client";
import { ApiError } from "./http";
import { effortFor, modelFor } from "./models";
import { logUsage } from "./structured";

const TURN_TIMEOUT_MS = 45_000;
const encoder = new TextEncoder();

/**
 * Streams the employee's next line as UTF-8 text deltas.
 *
 * The first delta is awaited before returning, so failures that happen before
 * any output (bad key, rate limit, refusal, timeout) can still become a clean
 * JSON error with a real status code instead of a broken 200 stream.
 */
export async function streamEmployeeReply(
  spec: ScenarioSpec,
  turns: Turn[],
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const model = modelFor("rolePlayer");
  const started = Date.now();

  const stream = getClient().messages.stream(
    {
      model,
      max_tokens: 400, // replies are 1-4 sentences
      system: [{ type: "text", text: rolePlayerSystemPrompt(spec), cache_control: { type: "ephemeral" } }],
      messages: rolePlayerMessages(turns),
      output_config: { effort: effortFor("rolePlayer") },
      // Sonnet 5.5 rejects thinking: disabled; between_tools is the "off" switch.
      // Short in-character replies do not benefit from deliberation and every
      // thinking token delays the first visible word.
      ...(model.startsWith("claude-sonnet-5-5") ? { thinking: { type: "between_tools" as const } } : {}),
    },
    { timeout: TURN_TIMEOUT_MS, signal },
  );

  const iterator = textDeltas(stream)[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done || !first.value) {
    const final = await stream.finalMessage().catch(() => null);
    if (final) logUsage("roleplay.turn(empty)", final.usage, Date.now() - started);
    throw new ApiError(502, "The AI did not produce a reply. Please try again.");
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(first.value));
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          controller.enqueue(encoder.encode(next.value));
        }
        const final = await stream.finalMessage();
        logUsage("roleplay.turn", final.usage, Date.now() - started);
        controller.close();
      } catch (err) {
        // Headers are already sent; the best we can do is end the stream.
        if (!signal.aborted) console.error("[ai] roleplay.turn stream failed mid-reply:", errName(err));
        controller.close();
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });
}

async function* textDeltas(stream: ReturnType<Anthropic["messages"]["stream"]>): AsyncGenerator<string> {
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

function errName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown";
}
