import type { VoiceFailReason } from '@antelope/core';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { friendlyError, withTimeout, type FriendlyError } from '@/components/practice-loop/errors';
import { ApiError, postForm, postForResponse } from '@/lib/api';
import { track } from '@/lib/analytics';
import { sentenceSplitter } from './sentences';
import { armGestureUnlock, createSpeechPlayer, discardRecording, type SpeechClip, type SpeechPlayer } from './speechPlayer';
import { MAX_RECORDING_MS, MIN_RECORDING_MS, RECORDING, audioPart } from './voiceSupport';

/**
 * idle → recording → transcribing → thinking → speaking → idle
 *
 *   recording     the mic is held. Release sends, a slide away cancels, 59s sends on its own.
 *   transcribing  the take is uploaded to /api/voice/transcribe.
 *   thinking      the transcript has gone into the normal turn flow; waiting for the first spoken sentence.
 *   speaking      the persona's reply plays, sentence by sentence, while its captions stream.
 * Pressing the mic while speaking interrupts: playback stops, the queue clears, recording starts.
 */
export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking';

/** Why Talk can't carry on: Conversation falls back to Type with a one-line note. */
export type VoiceFallback = 'permission' | 'unavailable';

/** Where the streamed reply text goes so it can be spoken (`useEmployeeReply`'s request). */
export interface ReplySink {
  push(chunk: string): void;
  end(): void;
  fail(): void;
}

export interface VoiceNotice {
  text: string;
  /** A request failure in coach voice (limits, offline). With `retry`, the take is kept. */
  error?: FriendlyError;
  retry?: boolean;
}

interface Take {
  started: number | null;
  released: boolean;
  cancelled: boolean;
}

interface Queue {
  gen: number;
  ctrl: AbortController;
  loads: (Promise<SpeechClip | null> | undefined)[];
  ended: boolean;
  resume: () => void;
}

const NO_SPEECH = 'Didn’t catch that. Hold and try again.';

/** dBFS (−160 silence … 0 full scale) → 0..1 for the level ring. Speech sits around −35…−15. */
function levelOf(db: number): number {
  return Math.max(0, Math.min(1, (db + 55) / 45));
}

function failReason(e: unknown): VoiceFailReason {
  if (e instanceof ApiError) {
    if (e.status === 422) return 'no_speech';
    if (e.status === 413) return 'too_large';
    if (e.status === 429) return 'rate_limited';
    if (e.status === 404 || (e.status === 503 && (e.code === 'voice_unavailable' || e.message === 'voice_unavailable'))) return 'unavailable';
    return 'server';
  }
  return 'offline';
}

function isPermissionError(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name ?? '';
  const msg = String((e as { message?: string } | null)?.message ?? '');
  return name === 'NotAllowedError' || name === 'SecurityError' || /permission/i.test(msg);
}

export function useVoiceTurn({
  scenarioId,
  enabled,
  muted,
  onTranscript,
  onFallback,
}: {
  scenarioId: string;
  /** Talk mode is on (the hook stays mounted in Type mode but does nothing). */
  enabled: boolean;
  muted: boolean;
  /** The words become the learner's turn, through the same path a typed reply takes. */
  onTranscript: (text: string) => void;
  onFallback: (why: VoiceFallback) => void;
}) {
  const recorder = useAudioRecorder(RECORDING);
  const [state, setStateNow] = useState<VoiceState>('idle');
  const [notice, setNotice] = useState<VoiceNotice | null>(null);
  /** When this take started recording (drives the timer; set once per take). */
  const [since, setSince] = useState<number | null>(null);
  /** Mic input level 0..1, written ~16×/s from the recorder's metering, read on the UI thread. */
  const level = useSharedValue(0);
  /** Playback level 0..1 where the platform reports it (iOS); otherwise the ring breathes on its own. */
  const speakLevel: SharedValue<number> = useSharedValue(0);

  const stateRef = useRef<VoiceState>('idle');
  const setState = useCallback((s: VoiceState) => {
    stateRef.current = s;
    setStateNow(s);
  }, []);
  const mutedRef = useRef(muted);
  const cb = useRef({ onTranscript, onFallback });
  useEffect(() => {
    cb.current = { onTranscript, onFallback };
  });
  const [player] = useState<SpeechPlayer>(createSpeechPlayer);
  const take = useRef<Take | null>(null);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);
  const upload = useRef<ReturnType<typeof withTimeout> | null>(null);
  const lastForm = useRef<{ form: FormData; ms: number } | null>(null);
  const queue = useRef<Queue | null>(null);
  const gen = useRef(0);
  const modeSet = useRef(false);
  const alive = useRef(true);

  // ---- playback ---------------------------------------------------------------------------

  const stopSpeaking = useCallback(() => {
    const q = queue.current;
    queue.current = null;
    gen.current++;
    if (q) {
      q.ctrl.abort();
      q.loads.forEach((p) => p?.then((c) => c?.release()));
    }
    player.stop();
    speakLevel.value = withTiming(0, { duration: 160 });
  }, [player, speakLevel]);

  /** Called as a reply request starts: the reply's text arrives through the returned sink. */
  const beginReply = useCallback((): ReplySink => {
    stopSpeaking();
    const my = gen.current;
    const ctrl = new AbortController();
    const sentences: string[] = [];
    let playing = -1;
    let running = false;
    let failed = false;
    const q: Queue = { gen: my, ctrl, loads: [], ended: false, resume: () => void pump() };
    queue.current = q;
    const current = () => gen.current === my;
    // a reply that isn't a voice hand-off (Resend after an error) still waits like one
    if (stateRef.current === 'idle') setState('thinking');

    const settle = () => {
      if (!current()) return;
      speakLevel.value = withTiming(0, { duration: 200 });
      if (stateRef.current === 'thinking' || stateRef.current === 'speaking') setState('idle');
    };

    const load = (i: number) =>
      (q.loads[i] ??= postForResponse('/api/voice/speak', { scenarioId, text: sentences[i] }, ctrl.signal)
        .then((res) => player.load(res, i))
        .catch(() => null));

    async function pump() {
      if (running) return;
      running = true;
      try {
        for (;;) {
          if (!current()) return;
          const i = playing + 1;
          if (mutedRef.current || i >= sentences.length) {
            if (q.ended || failed) settle();
            return;
          }
          const clip = await load(i);
          if (!current() || mutedRef.current) {
            clip?.release();
            if (!current()) return;
            continue;
          }
          playing = i;
          // in order: sentence n+1 is fetched while n plays
          if (i + 1 < sentences.length) void load(i + 1);
          if (!clip) continue;
          if (stateRef.current !== 'speaking') setState('speaking');
          await player.play(clip);
          clip.release();
        }
      } finally {
        running = false;
      }
    }

    const split = sentenceSplitter((s) => {
      if (!current()) return;
      sentences.push(s);
      const i = sentences.length - 1;
      if (mutedRef.current) return;
      if (playing >= 0 && i === playing + 1) void load(i);
      void pump();
    });

    return {
      push: (chunk) => current() && split.push(chunk),
      end: () => {
        if (!current()) return;
        q.ended = true;
        split.end();
        void pump();
      },
      fail: () => {
        if (!current()) return;
        failed = true;
        q.ended = true;
        split.end();
        void pump();
      },
    };
  }, [player, scenarioId, setState, speakLevel, stopSpeaking]);

  // Mute: stop now, keep the captions. Unmute: speak from the next sentence.
  useEffect(() => {
    mutedRef.current = muted;
    if (muted) {
      player.stop();
      speakLevel.value = withTiming(0, { duration: 160 });
      if (stateRef.current === 'speaking') setState(queue.current?.ended ? 'idle' : 'thinking');
    } else queue.current?.resume();
  }, [muted, player, setState, speakLevel]);

  useEffect(() => {
    player.onLevel = (v) => {
      speakLevel.value = withTiming(v, { duration: 90 });
    };
  }, [player, speakLevel]);

  // ---- recording --------------------------------------------------------------------------

  const stopMeter = useCallback(() => {
    if (meter.current) clearInterval(meter.current);
    meter.current = null;
    level.value = withTiming(0, { duration: 180 });
  }, [level]);

  const stopRecorder = useCallback(async () => {
    try {
      if (recorder.getStatus().isRecording) await recorder.stop();
    } catch {
      // never started, or already stopped
    }
  }, [recorder]);

  const send = useCallback(
    async (form: FormData, ms: number) => {
      setState('transcribing');
      setNotice(null);
      upload.current?.abort();
      const req = withTimeout(30_000);
      upload.current = req;
      try {
        const res = await postForm<{ text?: string }>('/api/voice/transcribe', form, req.signal);
        if (upload.current !== req || !alive.current) return;
        lastForm.current = null;
        const text = (res.text ?? '').trim();
        if (!text) throw new ApiError(422, 'no_speech');
        setState('thinking');
        cb.current.onTranscript(text);
      } catch (e) {
        if (upload.current !== req || !alive.current) return;
        const reason = failReason(e);
        track('voice_transcribe_failed', { reason });
        setState('idle');
        if (reason === 'unavailable') {
          lastForm.current = null;
          cb.current.onFallback('unavailable');
        } else if (reason === 'no_speech') {
          lastForm.current = null;
          setNotice({ text: NO_SPEECH });
        } else if (reason === 'too_large') {
          lastForm.current = null;
          setNotice({ text: 'That one ran long. Try it in a shorter turn.' });
        } else {
          // offline, limits, a server snag: keep the take so "Try again" doesn't make them say it twice
          lastForm.current = { form, ms };
          const err = friendlyError(e);
          setNotice({ text: `${err.title}. ${err.detail}`, error: err, retry: reason !== 'rate_limited' });
        }
      } finally {
        req.clear();
      }
    },
    [setState],
  );

  const finish = useCallback(
    async (t: Take) => {
      stopMeter();
      setSince(null);
      const ms = t.started ? Date.now() - t.started : 0;
      if (t.cancelled || ms < MIN_RECORDING_MS) {
        await stopRecorder();
        discardRecording(recorder.uri);
        if (take.current === t) take.current = null;
        if (stateRef.current === 'recording') setState('idle');
        if (!t.cancelled) setNotice({ text: 'Hold the mic while you talk, then let go.' });
        return;
      }
      setState('transcribing');
      await stopRecorder();
      if (take.current !== t || !alive.current) return;
      take.current = null;
      const uri = recorder.uri;
      if (!uri) {
        setState('idle');
        setNotice({ text: NO_SPEECH });
        return;
      }
      track('voice_turn_recorded', { scenario_id: scenarioId, duration_ms: Math.round(ms) });
      const form = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        const part = audioPart(blob.type || RECORDING.web?.mimeType);
        form.append('audio', blob, part.name);
      } else {
        // React Native's FormData streams the file from disk
        form.append('audio', { uri, ...audioPart(undefined) } as unknown as Blob);
      }
      form.append('scenarioId', scenarioId);
      form.append('durationMs', String(Math.round(ms)));
      // the bytes are in the form now; the recording itself isn't kept
      if (Platform.OS === 'web') discardRecording(uri);
      await send(form, ms);
      if (Platform.OS !== 'web') discardRecording(uri);
    },
    [recorder, scenarioId, send, setState, stopMeter, stopRecorder],
  );

  /** Mic down. Call synchronously from the gesture (it also unlocks web playback). */
  const press = useCallback(() => {
    if (!enabled) return;
    const s = stateRef.current;
    if (s === 'recording' || s === 'transcribing' || s === 'thinking') return;
    player.unlock();
    if (s === 'speaking') stopSpeaking();
    setNotice(null);
    lastForm.current = null;
    const t: Take = { started: null, released: false, cancelled: false };
    take.current = t;
    setState('recording');
    void (async () => {
      try {
        if (Platform.OS !== 'web' && !modeSet.current) {
          // PlayAndRecord + DefaultToSpeaker on iOS: record, and replies still come out of the speaker
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
          modeSet.current = true;
        }
        await recorder.prepareToRecordAsync();
        if (take.current !== t || t.cancelled || !alive.current) {
          if (take.current === t) take.current = null;
          // prepared but no longer wanted: start and stop at once so the mic (and its indicator) let go
          recorder.record();
          await stopRecorder();
          discardRecording(recorder.uri);
          return;
        }
        recorder.record();
        t.started = Date.now();
        setSince(t.started);
        meter.current = setInterval(() => {
          const st = recorder.getStatus();
          level.value = withTiming(levelOf(typeof st.metering === 'number' ? st.metering : -160), { duration: 80 });
          if (t.started && Date.now() - t.started >= MAX_RECORDING_MS && !t.released) {
            t.released = true;
            void finish(t);
          }
        }, 60);
        // let go while the mic was still starting: settle it now (a tap is too short to send)
        if (t.released) void finish(t);
      } catch (e) {
        if (take.current !== t) return;
        take.current = null;
        setState('idle');
        if (isPermissionError(e)) {
          track('voice_transcribe_failed', { reason: 'permission' });
          cb.current.onFallback('permission');
        } else setNotice({ text: 'The mic didn’t start. Hold to try again.' });
      }
    })();
  }, [enabled, finish, level, player, recorder, setState, stopRecorder, stopSpeaking]);

  /** Mic up: send. */
  const release = useCallback(() => {
    const t = take.current;
    player.unlock();
    if (!t || t.released) return;
    t.released = true;
    if (t.started !== null) void finish(t);
  }, [finish, player]);

  /** Slid away: discard this take. */
  const cancel = useCallback(() => {
    const t = take.current;
    if (!t) return;
    t.cancelled = true;
    t.released = true;
    if (t.started !== null) void finish(t);
    else {
      take.current = null;
      setState('idle');
    }
  }, [finish, setState]);

  /** Re-send the last take after a failure that wasn't about the words (offline, a snag). */
  const retry = useCallback(() => {
    const last = lastForm.current;
    if (last) void send(last.form, last.ms);
  }, [send]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  // ---- lifecycle --------------------------------------------------------------------------

  // Talk mode: check the mic up front (the first hold should just work), and arm the web unlock.
  useEffect(() => {
    if (!enabled) return;
    const disarm = armGestureUnlock();
    let live = true;
    (async () => {
      const now = await getRecordingPermissionsAsync();
      if (now.granted) return;
      const asked = now.canAskAgain ? await requestRecordingPermissionsAsync() : now;
      if (!asked.granted && live) {
        track('voice_transcribe_failed', { reason: 'permission' });
        cb.current.onFallback('permission');
      }
    })().catch(() => {});
    return () => {
      live = false;
      disarm();
    };
  }, [enabled]);

  // Backgrounded (or the tab hidden): drop a take in progress and stop talking.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') return;
      if (take.current) cancel();
      if (stateRef.current === 'speaking') {
        stopSpeaking();
        setState('idle');
      }
    });
    return () => sub.remove();
  }, [cancel, setState, stopSpeaking]);

  // Leaving Talk mode (fallback to Type) or unmounting: release everything.
  useEffect(() => {
    if (enabled) return;
    if (take.current) cancel();
    stopSpeaking();
  }, [enabled, cancel, stopSpeaking]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (meter.current) clearInterval(meter.current);
      upload.current?.abort();
      const t = take.current;
      take.current = null;
      if (t) {
        t.cancelled = true;
        recorder
          .stop()
          .catch(() => {})
          .finally(() => discardRecording(recorder.uri));
      }
      stopSpeaking();
      player.release();
      if (Platform.OS !== 'web' && modeSet.current) setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, notice, since, level, speakLevel, press, release, cancel, retry, dismissNotice, beginReply, stopSpeaking };
}

export type VoiceTurn = ReturnType<typeof useVoiceTurn>;
