/** One spoken sentence, ready to play. `release()` frees its blob URL or cache file. */
export interface SpeechClip {
  uri: string;
  release(): void;
}

/**
 * Plays the persona's sentences one after another through ONE long-lived output, so
 * the unlock done in the mic gesture (iOS Safari) carries over to every later clip.
 *
 * - `unlock()` must be called synchronously inside a user gesture (touchend, click).
 * - `play()` resolves `true` when the clip ends, `false` when it was stopped or blocked.
 * - `onLevel` (native only, when the platform offers samples): playback loudness 0..1,
 *   for the speaking ring. Called from player events, never per frame from a timer.
 */
export interface SpeechPlayer {
  unlock(): void;
  load(res: Response, index: number): Promise<SpeechClip>;
  play(clip: SpeechClip): Promise<boolean>;
  stop(): void;
  release(): void;
  onLevel?: (level: number) => void;
}
