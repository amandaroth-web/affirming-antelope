import { createAudioPlayer, type AudioPlayer, type AudioSample, type AudioStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { SpeechClip, SpeechPlayer } from './speechPlayer.types';

export type { SpeechClip, SpeechPlayer } from './speechPlayer.types';

/** Native has no autoplay gate: nothing to prime. */
export function primeSpeech(): void {}
export function armGestureUnlock(): () => void {
  return () => {};
}

/**
 * Native playback (expo-audio): one player, `replace()`d per sentence. Each sentence's
 * MP3 is written to the cache (the speak endpoint is a POST with a bearer token, which
 * a player source can't make) and deleted once it has played.
 * iOS: the conversation sets `allowsRecording` + `playsInSilentMode`, i.e. PlayAndRecord
 * with DefaultToSpeaker, so replies come out of the speaker, not the earpiece.
 */
export function createSpeechPlayer(): SpeechPlayer {
  let player: AudioPlayer | null = null;
  let finish: ((ended: boolean) => void) | null = null;
  let current: string | null = null;
  let statusSub: { remove(): void } | null = null;
  let sampleSub: { remove(): void } | null = null;

  const settle = (ended: boolean) => {
    const f = finish;
    finish = null;
    current = null;
    f?.(ended);
  };

  const self: SpeechPlayer = {
    unlock: () => {},

    async load(res: Response, index: number): Promise<SpeechClip> {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const file = new File(Paths.cache, `voice-${Date.now()}-${index}.mp3`);
      file.write(bytes);
      return {
        uri: file.uri,
        release: () => {
          try {
            file.delete();
          } catch {
            // already gone
          }
        },
      };
    },

    play(clip: SpeechClip): Promise<boolean> {
      settle(false);
      if (!player) {
        player = createAudioPlayer(null, { updateInterval: 100 });
        statusSub = player.addListener('playbackStatusUpdate', (s: AudioStatus) => {
          if (s.didJustFinish && current) settle(true);
        });
        // playback loudness for the speaking ring (iOS taps the output; Android's visualizer needs the mic permission)
        if (Platform.OS === 'ios') {
          try {
            player.setAudioSamplingEnabled(true);
            sampleSub = player.addListener('audioSampleUpdate', (sample: AudioSample) => {
              const frames = sample.channels[0]?.frames;
              if (!frames?.length || !current) return;
              let sum = 0;
              for (let i = 0; i < frames.length; i += 4) sum += frames[i] * frames[i];
              const rms = Math.sqrt(sum / Math.ceil(frames.length / 4));
              self.onLevel?.(Math.min(1, rms * 4));
            });
          } catch {
            sampleSub = null;
          }
        }
      }
      const p = player;
      return new Promise<boolean>((resolve) => {
        finish = resolve;
        current = clip.uri;
        p.replace({ uri: clip.uri });
        p.play();
      });
    },

    stop() {
      if (player && current) player.pause();
      settle(false);
      self.onLevel?.(0);
    },

    release() {
      self.stop();
      statusSub?.remove();
      sampleSub?.remove();
      player?.remove();
      player = null;
    },
  };
  return self;
}

/** Throw away a finished recording once it's uploaded (no audio is kept, docs/voice.md). */
export function discardRecording(uri: string | null): void {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // already gone
  }
}
