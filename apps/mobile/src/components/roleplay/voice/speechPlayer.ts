import type { SpeechPlayer } from './speechPlayer.types';

export type { SpeechClip, SpeechPlayer } from './speechPlayer.types';

/**
 * Fallback only (Metro always picks `.web.ts` or `.native.ts`; TypeScript resolves this
 * file): a player that plays nothing, so captions still work.
 */
export function createSpeechPlayer(): SpeechPlayer {
  return {
    unlock: () => {},
    load: async () => ({ uri: '', release: () => {} }),
    play: async () => false,
    stop: () => {},
    release: () => {},
  };
}

/** Prime playback from a gesture that happens before the conversation (the brief's START). */
export function primeSpeech(): void {}

/** Web only: any tap while a voice conversation is open also unlocks playback. Returns the disposer. */
export function armGestureUnlock(): () => void {
  return () => {};
}

/** Throw away a finished recording once it's uploaded (no audio is kept, docs/voice.md). */
export function discardRecording(_uri: string | null): void {}
