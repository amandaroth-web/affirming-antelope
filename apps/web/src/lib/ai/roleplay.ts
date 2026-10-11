import { rolePlayerMessages, rolePlayerSystemPrompt, type ScenarioSpec, type Turn } from "@antelope/core";
import { ApiError } from "./http";
import { logUsage, resolveRole } from "./providers";

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
  const { provider, model } = resolveRole("rolePlayer");
  const started = Date.now();
  const log = async (label: string, ttfbMs?: number) =>
    logUsage({
      provider: provider.id,
      model,
      role: "rolePlayer",
      label,
      ms: Date.now() - started,
      ttfbMs,
      usage: await stream.usage(),
    });

  const stream = provider.streamText({
    role: "rolePlayer",
    model,
    maxTokens: 400, // replies are 1-4 sentences
    system: rolePlayerSystemPrompt(spec),
    messages: rolePlayerMessages(turns),
    timeoutMs: TURN_TIMEOUT_MS,
    signal,
    cacheKey: `rolePlayer:${spec.id}`,
  });

  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done || !first.value) {
    await log("roleplay.turn(empty)");
    throw new ApiError(502, "The AI did not produce a reply. Please try again.");
  }
  const ttfbMs = Date.now() - started;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(first.value));
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          controller.enqueue(encoder.encode(next.value));
        }
        await log("roleplay.turn", ttfbMs);
        controller.close();
      } catch (err) {
        // Headers are already sent; the best we can do is end the stream.
        if (!signal.aborted) console.error("[ai] roleplay.turn stream failed mid-reply:", errName(err));
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
}

function errName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown";
}
