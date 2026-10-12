import type { SpeechClip, SpeechPlayer } from './speechPlayer.types';

export type { SpeechClip, SpeechPlayer } from './speechPlayer.types';

/**
 * Web playback for spoken replies: one `<audio>` element for the whole app session.
 *
 * Why not expo-audio's web player: its `replace()` makes a new `Audio()` per source,
 * and iOS Safari only lets an element play without a gesture once that same element
 * has been played inside one. So the element is created once, "unlocked" by playing a
 * 30ms silent WAV synchronously inside a gesture (the brief's START, then every mic
 * press and release, plus any touchend/click while a voice conversation is open), and
 * every sentence after that is just a new `src` on the unlocked element.
 */

// 30ms of 8kHz 8-bit silence: header (+1 sample) then 240 more samples of 0x80
const SILENCE = `data:audio/wav;base64,UklGRhUBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YfEAAACA${'gICA'.repeat(80)}`;

let element: HTMLAudioElement | null = null;
let unlocked = false;
/** The clip the app actually wants to hear (the unlock must never interrupt it). */
let current: string | null = null;

function audio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!element) {
    element = new Audio();
    element.preload = 'auto';
    // iOS: play inline, never take over the screen
    element.setAttribute('playsinline', '');
  }
  return element;
}

/** Synchronous, inside a gesture. Cheap to call again; does nothing once unlocked or mid-clip. */
export function primeSpeech(): void {
  const el = audio();
  if (!el || unlocked || current) return;
  el.src = SILENCE;
  const p = el.play();
  if (p && typeof p.then === 'function') {
    p.then(() => {
      unlocked = true;
      if (!current) el.pause();
    }).catch(() => {});
  }
}

/** While a voice conversation is open, any tap or key also unlocks (capture phase, before the app sees it). */
export function armGestureUnlock(): () => void {
  if (typeof document === 'undefined') return () => {};
  const events = ['touchend', 'pointerup', 'mouseup', 'click', 'keydown'] as const;
  const on = () => {
    primeSpeech();
    if (unlocked) off();
  };
  const off = () => events.forEach((e) => document.removeEventListener(e, on, true));
  events.forEach((e) => document.addEventListener(e, on, true));
  return off;
}

export function createSpeechPlayer(): SpeechPlayer {
  let finish: ((ended: boolean) => void) | null = null;

  const settle = (ended: boolean) => {
    const f = finish;
    finish = null;
    current = null;
    f?.(ended);
  };

  return {
    unlock: primeSpeech,

    async load(res: Response): Promise<SpeechClip> {
      const blob = await res.blob();
      const uri = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' }));
      return { uri, release: () => URL.revokeObjectURL(uri) };
    },

    play(clip: SpeechClip): Promise<boolean> {
      const el = audio();
      if (!el) return Promise.resolve(false);
      settle(false);
      return new Promise<boolean>((resolve) => {
        finish = resolve;
        current = clip.uri;
        const done = () => {
          el.removeEventListener('ended', done);
          el.removeEventListener('error', failed);
          if (current === clip.uri) settle(true);
        };
        const failed = () => {
          el.removeEventListener('ended', done);
          el.removeEventListener('error', failed);
          if (current === clip.uri) settle(false);
        };
        el.addEventListener('ended', done);
        el.addEventListener('error', failed);
        el.src = clip.uri;
        const p = el.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            unlocked = true;
          }).catch(() => {
            // NotAllowedError (no gesture yet) or a clip the browser can't decode: captions carry on
            if (current === clip.uri) failed();
          });
        }
      });
    },

    stop() {
      const el = element;
      if (el && current) {
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
      settle(false);
    },

    release() {
      this.stop();
    },
  };
}

/** Throw away a finished recording once it's uploaded (no audio is kept, docs/voice.md). */
export function discardRecording(uri: string | null): void {
  if (uri?.startsWith('blob:')) URL.revokeObjectURL(uri);
}
