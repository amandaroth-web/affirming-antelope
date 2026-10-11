import { missingKeys } from "./providers";

export type AiMode = "live" | "mock" | "unavailable";

let loggedMode: string | null = null;

/**
 * live: real provider calls.
 * mock: deterministic canned responses (AI_MOCK=1, or a missing key in development).
 * unavailable: production with a missing key (routes answer 503).
 *
 * "Missing key" means the key of any provider a role is configured to use
 * (AI_PROVIDER, AI_PROVIDER_<ROLE>; see ./models.ts).
 */
export function aiMode(): AiMode {
  const flag = process.env.AI_MOCK?.trim().toLowerCase();
  const forcedMock = flag === "1" || flag === "true";
  const missing = missingKeys();
  const isProd = process.env.NODE_ENV === "production";

  const mode: AiMode = forcedMock ? "mock" : missing.length === 0 ? "live" : isProd ? "unavailable" : "mock";

  const logKey = `${mode}:${missing.join(",")}`;
  if (loggedMode !== logKey) {
    loggedMode = logKey;
    if (mode === "mock") {
      console.log(
        `[ai] MOCK MODE active (${forcedMock ? "AI_MOCK=1" : `${missing.join(", ")} not set`}). Responses are canned; no AI provider calls are made.`,
      );
    } else if (mode === "unavailable") {
      console.error(`[ai] ${missing.join(", ")} is not set in production; AI endpoints will return 503.`);
    }
  }
  return mode;
}
