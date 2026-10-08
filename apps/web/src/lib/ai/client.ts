import Anthropic from "@anthropic-ai/sdk";

export type AiMode = "live" | "mock" | "unavailable";

let loggedMode: AiMode | null = null;

/**
 * live: real Anthropic calls.
 * mock: deterministic canned responses (AI_MOCK=1, or no key in development).
 * unavailable: production with no key (routes answer 503).
 */
export function aiMode(): AiMode {
  const flag = process.env.AI_MOCK?.trim().toLowerCase();
  const forcedMock = flag === "1" || flag === "true";
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const isProd = process.env.NODE_ENV === "production";

  const mode: AiMode = forcedMock ? "mock" : hasKey ? "live" : isProd ? "unavailable" : "mock";

  if (loggedMode !== mode) {
    loggedMode = mode;
    if (mode === "mock") {
      console.log(
        `[ai] MOCK MODE active (${forcedMock ? "AI_MOCK=1" : "ANTHROPIC_API_KEY not set"}). Responses are canned; no Anthropic calls are made.`,
      );
    } else if (mode === "unavailable") {
      console.error("[ai] ANTHROPIC_API_KEY is not set in production; AI endpoints will return 503.");
    }
  }
  return mode;
}

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    // One SDK-level retry for 429/5xx/connection errors; per-call timeouts are
    // set at the call site so a retry cannot silently double a long wait.
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  }
  return client;
}
