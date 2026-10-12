// Three separate AI functions, kept conceptually apart:
//   Role-Player (realism), Observer (analysis), Coach (teaching).
// The drill coach is a lightweight Coach for single drill responses.

export * from "./rolePlayer";
export * from "./observer";
export * from "./coach";
export * from "./drillCoach";

/** Intended model per AI role. The API layer may adjust. */
export const MODEL_ROLES = {
  rolePlayer: "claude-sonnet-5-5",
  observer: "claude-sonnet-5-5",
  coach: "claude-opus-5-5",
  drillCoach: "claude-sonnet-5-5",
} as const;

export type ModelRole = keyof typeof MODEL_ROLES;

/**
 * Intended OpenAI audio models for voice role-play (docs/voice.md). The API layer may
 * override them with AI_VOICE_STT_MODEL / AI_VOICE_TTS_MODEL.
 * - transcription: gpt-transcribe, OpenAI's recommended file-transcription model
 *   (about $0.0045 per minute of audio; supports `prompt`).
 * - tts: gpt-4o-mini-tts, the only speech model that takes style `instructions`
 *   (about $0.60 per 1M text tokens in, $12 per 1M audio tokens out, roughly $0.015
 *   per minute of speech).
 */
export const VOICE_MODELS = {
  transcription: "gpt-transcribe",
  tts: "gpt-4o-mini-tts",
} as const;
