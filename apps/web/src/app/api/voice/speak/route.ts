import { getScenario } from "@antelope/core";
import { ApiError, corsHeaders, errorResponse, optionsResponse, readJson } from "@/lib/ai/http";
import { authenticate, chargeQuota } from "@/lib/ai/auth";
import { parseScenarioId } from "@/lib/ai/validate";
import {
  MAX_SPEAK_CHARS,
  chunkedStream,
  logVoiceUsage,
  mockMp3,
  requireUserCaller,
  toVoiceError,
  voiceClient,
  voiceMode,
  voiceModels,
} from "@/lib/ai/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

// Used only if a scenario has no voice of its own.
const FALLBACK_VOICE = { openai: "marin", instructions: "A natural, conversational adult voice. Calm, moderate pace." };

/**
 * POST /api/voice/speak (docs/voice.md)
 * JSON { scenarioId, text (at most 600 chars) } -> streamed audio/mpeg in the persona's
 * voice. The provider's response body is passed straight through, so the first audio
 * bytes reach the client as soon as the provider produces them.
 * The audio is personal to this request: never cached anywhere.
 */
export async function POST(req: Request) {
  try {
    const caller = await authenticate(req);
    requireUserCaller(caller);
    const mode = voiceMode();

    const { id, obj } = parseScenarioId(await readJson(req));
    const spec = getScenario(id);
    if (!spec) throw new ApiError(404, `Unknown scenario "${id}".`);
    if (typeof obj.text !== "string" || !obj.text.trim()) throw new ApiError(400, "text is required.");
    const text = obj.text.trim();
    if (text.length > MAX_SPEAK_CHARS) {
      throw new ApiError(400, `text is too long (max ${MAX_SPEAK_CHARS} characters).`);
    }

    const quota = await chargeQuota(caller, "tts");
    const voice = spec.persona.voice ?? FALLBACK_VOICE;
    const started = Date.now();

    let body: ReadableStream<Uint8Array>;
    let model = "mock";
    if (mode === "mock") {
      body = chunkedStream(mockMp3(text), 2048, 20, req.signal);
    } else {
      model = voiceModels().tts;
      let upstream: Response;
      try {
        upstream = await voiceClient().audio.speech.create(
          {
            model,
            voice: voice.openai,
            input: text,
            // Only gpt-4o-mini-tts takes style instructions; tts-1 models reject the field.
            ...(model.includes("tts-1") ? {} : { instructions: voice.instructions }),
            response_format: "mp3",
          },
          { signal: req.signal },
        );
      } catch (err) {
        throw toVoiceError(err, "tts");
      }
      if (!upstream.body) throw new ApiError(502, "The AI service returned an error. Please try again.");
      body = upstream.body;
    }

    logVoiceUsage({
      label: "tts",
      provider: mode === "mock" ? "mock" : "openai",
      model,
      scenario: spec.id,
      voice: voice.openai,
      chars: text.length,
      ttfb_ms: Date.now() - started,
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        // Personalised audio: no shared or browser cache, no transformation by proxies.
        "Cache-Control": "private, no-store, no-transform",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Accel-Buffering": "no",
        ...corsHeaders(req),
        Vary: "Origin, Authorization",
        ...quota,
      },
    });
  } catch (err) {
    return errorResponse(req, err);
  }
}
