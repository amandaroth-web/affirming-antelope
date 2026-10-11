"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, Microphone, Pause, Play, Record, Stop, Trash } from "@phosphor-icons/react";
import { buttonClass, focusRing } from "../ui";

const MAX_SEC = 5 * 60;

export type Clip = { blob: Blob; url: string; mime: string; ext: "webm" | "m4a"; seconds: number };

type State =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "recording"; paused: boolean }
  | { kind: "denied"; message: string };

function pickMime(): { mime: string; ext: "webm" | "m4a" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const options: { mime: string; ext: "webm" | "m4a" }[] = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? { mime: "", ext: "webm" };
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Record (with pause/resume), stop, play back, re-record. Shows the stored clip when
 * there is one. The parent uploads on save; nothing leaves the browser before that.
 */
export function AudioRecorder({
  clip,
  onClip,
  storedUrl,
  onRemoveStored,
  learnerFirst,
}: {
  clip: Clip | null;
  onClip: (c: Clip | null) => void;
  storedUrl: string | null;
  onRemoveStored: () => void;
  learnerFirst: string;
}) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const tick = useRef<{ last: number; total: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const kind = useRef<{ mime: string; ext: "webm" | "m4a" }>({ mime: "", ext: "webm" });

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  async function start() {
    const picked = pickMime();
    if (!picked || !navigator.mediaDevices?.getUserMedia) {
      setState({ kind: "denied", message: "This browser can't record audio. Written feedback still works." });
      return;
    }
    kind.current = picked;
    setState({ kind: "starting" });
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const r = new MediaRecorder(s, picked.mime ? { mimeType: picked.mime } : undefined);
      rec.current = r;
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const base = (r.mimeType || picked.mime || "audio/webm").split(";")[0];
        const ext: "webm" | "m4a" = base.includes("mp4") || base.includes("m4a") || base.includes("aac") ? "m4a" : "webm";
        const mime = ext === "m4a" ? "audio/mp4" : "audio/webm";
        const blob = new Blob(chunks.current, { type: mime });
        const seconds = tick.current?.total ?? 0;
        cleanup();
        setState({ kind: "idle" });
        if (blob.size) onClip({ blob, url: URL.createObjectURL(blob), mime, ext, seconds });
      };
      r.start(250);

      // Live level meter.
      try {
        const ctx = new AudioContext();
        audioCtx.current = ctx;
        const src = ctx.createMediaStreamSource(s);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.2));
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        /* meter is decoration */
      }

      tick.current = { last: performance.now(), total: 0 };
      setElapsed(0);
      timer.current = setInterval(() => {
        const t = tick.current;
        if (!t || rec.current?.state !== "recording") return;
        const now = performance.now();
        t.total += (now - t.last) / 1000;
        t.last = now;
        setElapsed(t.total);
        if (t.total >= MAX_SEC) rec.current?.stop();
      }, 200);
      setState({ kind: "recording", paused: false });
    } catch (err) {
      cleanup();
      const name = (err as DOMException)?.name;
      setState({
        kind: "denied",
        message:
          name === "NotAllowedError"
            ? "Microphone access is blocked. Allow it in your browser's site settings, then try again."
            : "We couldn't find a microphone. Plug one in, or leave written feedback instead.",
      });
    }
  }

  function pause() {
    const r = rec.current;
    if (!r) return;
    if (r.state === "recording") {
      r.pause();
      setState({ kind: "recording", paused: true });
    } else if (r.state === "paused") {
      if (tick.current) tick.current.last = performance.now();
      r.resume();
      setState({ kind: "recording", paused: false });
    }
  }

  function stop() {
    const r = rec.current;
    if (r && r.state !== "inactive") {
      if (tick.current && r.state === "recording") {
        tick.current.total += (performance.now() - tick.current.last) / 1000;
      }
      r.stop();
    }
  }

  function discard() {
    if (clip) URL.revokeObjectURL(clip.url);
    onClip(null);
  }

  const recording = state.kind === "recording";
  const paused = recording && state.paused;

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {recording || state.kind === "starting" ? (
          <motion.div
            key="rec"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border-2 border-[#f0d3c6] bg-[#fdf6f2] p-4"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3" aria-hidden>
                {!paused && !reduce ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d0613a] opacity-60" /> : null}
                <span className={`relative inline-flex h-3 w-3 rounded-full ${paused ? "bg-faint" : "bg-[#d0613a]"}`} />
              </span>
              <p className="text-[14px] font-extrabold text-ink" aria-live="polite">
                {state.kind === "starting" ? "Starting microphone…" : paused ? "Paused" : "Recording"}
              </p>
              <p className="ml-auto font-display text-[18px] font-bold tabular-nums text-ink" aria-label={`Elapsed ${fmt(elapsed)}`}>
                {fmt(elapsed)}
                <span className="text-[13px] font-semibold text-muted"> / {fmt(MAX_SEC)}</span>
              </p>
            </div>
            <div className="mt-3 flex h-8 items-center gap-[3px]" aria-hidden>
              {Array.from({ length: 28 }).map((_, i) => {
                const wave = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 1.7));
                const h = paused ? 0.12 : Math.max(0.12, level * wave);
                return <span key={i} className="flex-1 rounded-full bg-[#d0613a]/70 transition-[height] duration-75" style={{ height: `${h * 100}%` }} />;
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={pause} disabled={!recording} className={buttonClass("secondary", "sm")}>
                {paused ? <Play size={15} weight="fill" aria-hidden /> : <Pause size={15} weight="fill" aria-hidden />}
                {paused ? "Resume" : "Pause"}
              </button>
              <button type="button" onClick={stop} disabled={!recording} className={buttonClass("primary", "sm")}>
                <Stop size={15} weight="fill" aria-hidden /> Stop
              </button>
            </div>
          </motion.div>
        ) : clip ? (
          <motion.div key="clip" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Player src={clip.url} label="New recording" fallbackSeconds={clip.seconds} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => { discard(); void start(); }} className={buttonClass("ghost", "sm")}>
                <ArrowCounterClockwise size={15} weight="bold" aria-hidden /> Re-record
              </button>
              <button type="button" onClick={discard} className={buttonClass("ghost", "sm")}>
                <Trash size={15} weight="bold" aria-hidden /> Discard
              </button>
              <span className="ml-auto self-center text-[12px] font-bold text-muted">Uploads when you save</span>
            </div>
          </motion.div>
        ) : storedUrl ? (
          <motion.div key="stored" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Player src={storedUrl} label="Saved recording" />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void start()} className={buttonClass("ghost", "sm")}>
                <Record size={15} weight="bold" aria-hidden /> Record a new one
              </button>
              <button type="button" onClick={onRemoveStored} className={buttonClass("ghost", "sm")}>
                <Trash size={15} weight="bold" aria-hidden /> Remove
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              type="button"
              onClick={() => void start()}
              className={`group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-white px-4 py-3 text-left transition-colors hover:border-primary-tint hover:bg-soft/40 ${focusRing}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-[0_3px_0_var(--primary-shadow)] transition-transform group-active:translate-y-[3px] group-active:shadow-none">
                <Microphone size={20} weight="fill" aria-hidden />
              </span>
              <span>
                <span className="block text-[14px] font-extrabold text-ink">Record a voice note</span>
                <span className="block text-[13px] font-semibold text-muted">Up to 5 minutes. {learnerFirst} hears it in the app.</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {state.kind === "denied" ? (
        <p role="alert" className="mt-2 text-[13px] font-bold text-[#a4472a]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

/** Compact player: play/pause, scrubber, time. Keyboard: space on the button, arrows on the slider. */
export function Player({ src, label, fallbackSeconds }: { src: string; label: string; fallbackSeconds?: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(fallbackSeconds ?? 0);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onMeta = () => {
      // MediaRecorder webm often reports Infinity until seeked once.
      if (!Number.isFinite(a.duration)) {
        a.currentTime = 1e6;
        const fix = () => {
          a.removeEventListener("timeupdate", fix);
          a.currentTime = 0;
          if (Number.isFinite(a.duration)) setDur(a.duration);
        };
        a.addEventListener("timeupdate", fix);
      } else setDur(a.duration);
    };
    const onTime = () => setT(a.currentTime);
    const onEnd = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onEnd);
    a.addEventListener("play", onPlay);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onEnd);
      a.removeEventListener("play", onPlay);
    };
  }, [src]);

  const max = dur || 1;
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-line bg-white px-3 py-2.5">
      <audio ref={ref} src={src} preload="metadata" />
      <button
        type="button"
        onClick={() => (playing ? ref.current?.pause() : void ref.current?.play())}
        aria-label={playing ? `Pause ${label.toLowerCase()}` : `Play ${label.toLowerCase()}`}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-white ${focusRing}`}
      >
        {playing ? <Pause size={18} weight="fill" aria-hidden /> : <Play size={18} weight="fill" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-extrabold text-muted">{label}</p>
        <input
          type="range"
          min={0}
          max={max}
          step={0.1}
          value={Math.min(t, max)}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (ref.current) ref.current.currentTime = v;
            setT(v);
          }}
          aria-label={`Position in ${label.toLowerCase()}`}
          className="mt-1 h-1.5 w-full cursor-pointer accent-[var(--primary)]"
        />
      </div>
      <span className="w-[76px] text-right text-[13px] font-extrabold tabular-nums text-ink/80">
        {fmt(t)} / {fmt(dur)}
      </span>
    </div>
  );
}
