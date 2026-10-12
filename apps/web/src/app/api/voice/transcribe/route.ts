import { getScenario } from "@antelope/core";
import { ApiError, errorResponse, jsonResponse, optionsResponse } from "@/lib/ai/http";
import { authenticate, chargeQuota } from "@/lib/ai/auth";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_MS,
  MAX_UPLOAD_BYTES,
  detectAudio,
  isNoSpeech,
  logVoiceUsage,
  mockTranscript,
  readBodyCapped,
  requireUserCaller,
  toFile,
  toVoiceError,
  transcriptionHints,
  voiceClient,
  voiceMode,
  voiceModels,
  wavDurationMs,
} from "@/lib/ai/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

/**
 * POST /api/voice/transcribe (docs/voice.md)
 * multipart/form-data: audio (webm/opus, mp4/m4a or wav), scenarioId, durationMs.
 * 200 { text, durationMs } | 422 { error: "no_speech" } | 413 too large or long |
 * 415 unreadable container | 503 { error: "voice_unavailable" }.
 * The audio is held in memory for the provider call and never stored.
 */
export async function POST(req: Request) {
  let provider: "openai" | "mock" = "openai";
  try {
    const caller = await authenticate(req);
    requireUserCaller(caller);
    const mode = voiceMode();
    provider = mode === "mock" ? "mock" : "openai";

    const contentType = req.headers.get("content-type") ?? "";
    if (!/^multipart\/form-data\s*;/i.test(contentType)) {
      throw new ApiError(400, "Request body must be multipart/form-data.");
    }
    const raw = await readBodyCapped(req, MAX_UPLOAD_BYTES);
    let form: FormData;
    try {
      form = await new Response(raw as BodyInit, { headers: { "content-type": contentType } }).formData();
    } catch {
      throw new ApiError(400, "Request body must be valid multipart/form-data.");
    }

    const scenarioId = form.get("scenarioId");
    if (typeof scenarioId !== "string" || !scenarioId.trim() || scenarioId.length > 64) {
      throw new ApiError(400, "scenarioId is required.");
    }
    const spec = getScenario(scenarioId.trim());
    if (!spec) throw new ApiError(404, `Unknown scenario "${scenarioId}".`);

    const durationField = form.get("durationMs");
    const claimedMs = typeof durationField === "string" && durationField.trim() ? Number(durationField) : NaN;
    if (!Number.isFinite(claimedMs) || claimedMs < 0) throw new ApiError(400, "durationMs is required.");

    const audio = form.get("audio");
    if (!(audio instanceof Blob)) throw new ApiError(400, "audio is required.");
    if (audio.size > MAX_AUDIO_BYTES) throw new ApiError(413, "audio_too_large", undefined, { code: "audio_too_large" });
    if (audio.size === 0) throw new ApiError(422, "no_speech", undefined, { code: "no_speech" });

    const bytes = new Uint8Array(await audio.arrayBuffer());
    const kind = detectAudio(bytes);
    if (!kind) {
      throw new ApiError(415, "Unsupported audio format. Send webm/opus, mp4/m4a or wav.", undefined, {
        code: "unsupported_audio",
      });
    }

    // The client reports the length; a wav's header lets us check it.
    const durationMs = Math.round(kind.ext === "wav" ? (wavDurationMs(bytes) ?? claimedMs) : claimedMs);
    if (durationMs > MAX_AUDIO_MS || claimedMs > MAX_AUDIO_MS) {
      throw new ApiError(413, "audio_too_long", undefined, { code: "audio_too_long" });
    }

    const quota = await chargeQuota(caller, "stt");
    const started = Date.now();
    let text: string;
    let model = "mock";

    if (mode === "mock") {
      text = mockTranscript(durationMs);
    } else {
      model = voiceModels().transcription;
      const hints = transcriptionHints(spec);
      try {
        const res = await voiceClient().audio.transcriptions.create(
          {
            file: await toFile(bytes, `audio.${kind.ext}`, { type: kind.mime }),
            model,
            language: "en",
            prompt: hints.prompt,
            // keywords is a gpt-transcribe parameter; the prompt carries the same hints for other models.
            ...(model === "gpt-transcribe" ? { keywords: hints.keywords } : {}),
            response_format: "json",
          },
          { signal: req.signal },
        );
        text = (res.text ?? "").trim();
      } catch (err) {
        throw toVoiceError(err, "stt");
      }
    }

    logVoiceUsage({
      label: "stt",
      provider,
      model,
      scenario: spec.id,
      bytes: audio.size,
      audio_ms: durationMs,
      ms: Date.now() - started,
      chars: text.length,
    });

    if (isNoSpeech(text)) throw new ApiError(422, "no_speech", undefined, { code: "no_speech" });
    return jsonResponse(req, { text, durationMs }, 200, quota);
  } catch (err) {
    return errorResponse(req, err);
  }
}
