"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { Star } from "@phosphor-icons/react";
import type { TurnAnnotation, Turn } from "@antelope/core";
import { FAMILY, MOVE, TALK, moveLabel, stanceLabel } from "@/lib/trainer/content";
import { Card, SectionTitle } from "../ui";
import { MoveShape } from "./trajectory-chart";

const TALK_STYLE = {
  change: "bg-[#e3f3f0] text-[#1f6b60]",
  sustain: "bg-[#f5f1e8] text-[#7a6a48]",
  neutral: "bg-soft text-ink/70",
} as const;

export function Transcript({
  turns,
  annotations,
  keyMomentIds,
  personaName,
  learnerName,
}: {
  turns: Turn[];
  annotations: TurnAnnotation[];
  keyMomentIds: string[];
  personaName: string;
  learnerName: string;
}) {
  const ann = new Map(annotations.map((a) => [a.turnId, a]));
  const keys = new Set(keyMomentIds);
  const persona = personaName.split(/\s+/)[0];
  const [showTags, setShowTags] = useState(true);

  return (
    <Card aria-labelledby="transcript" className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionTitle id="transcript">Transcript</SectionTitle>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-extrabold text-muted">
          <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Show observer tags
        </label>
      </div>
      <p className="mt-1 text-[14px] font-semibold text-muted">
        Tags come from the AI observer. Hover or focus a tag for its note.
      </p>
      <ol className="mt-6 grid gap-4">
        {turns.map((t) => {
          const a = ann.get(t.id);
          const learner = t.speaker === "learner";
          const key = learner && keys.has(t.id);
          return (
            <li key={t.id} id={`turn-${t.id}`} className={`flex scroll-mt-24 ${learner ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[min(560px,88%)] ${learner ? "items-end text-right" : ""} flex flex-col`}>
                <p className="mb-1 px-1 text-[12px] font-extrabold text-muted">{learner ? learnerName : persona}</p>
                <div
                  className={`rounded-[20px] border-2 px-4 py-3 text-left text-[15px] font-semibold leading-relaxed ${
                    learner
                      ? `rounded-br-md bg-primary-tint/35 text-ink ${key ? "border-gold" : "border-primary-tint/70"}`
                      : "rounded-bl-md border-line bg-white text-ink shadow-[0_3px_0_var(--shadow)]"
                  }`}
                >
                  {t.text}
                </div>
                {showTags && a ? (
                  <div className={`mt-1.5 flex flex-wrap gap-1.5 ${learner ? "justify-end" : ""}`}>
                    {learner && a.move ? (
                      <Tag
                        note={a.note}
                        className="border-2 bg-white"
                        style={{ borderColor: FAMILY[MOVE[a.move].family].color, color: FAMILY[MOVE[a.move].family].color }}
                        icon={
                          <svg width={12} height={12} viewBox="-7 -7 14 14" aria-hidden>
                            <MoveShape family={MOVE[a.move].family} size={4.6} stroke="none" />
                          </svg>
                        }
                      >
                        {moveLabel(a.move)}
                      </Tag>
                    ) : null}
                    {!learner && a.talk ? (
                      <Tag note={a.note} className={TALK_STYLE[a.talk]}>
                        {TALK[a.talk].label}
                        {a.stance ? <span className="font-bold opacity-75"> · {stanceLabel(a.stance, a.intensity)}</span> : null}
                      </Tag>
                    ) : null}
                    {key ? (
                      <a
                        href={`#km-${t.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-gold-tint px-2.5 py-0.5 text-[12px] font-extrabold text-gold-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
                      >
                        <Star size={11} weight="fill" aria-hidden /> Key moment
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Tag({
  children,
  note,
  className = "",
  style,
  icon,
}: {
  children: React.ReactNode;
  note?: string;
  className?: string;
  style?: React.CSSProperties;
  icon?: React.ReactNode;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const base = `relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ${className}`;
  if (!note) {
    return (
      <span className={base} style={style}>
        {icon}
        {children}
      </span>
    );
  }
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className={`${base} cursor-help focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40`}
        style={style}
      >
        {icon}
        {children}
      </button>
      <span id={id} role="tooltip" className="sr-only">
        {note}
      </span>
      <AnimatePresence>
        {open ? (
          <motion.span
            aria-hidden
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[260px] -translate-x-1/2 rounded-xl bg-navy px-3 py-2 text-left text-[13px] font-semibold leading-snug text-white shadow-[0_3px_0_rgba(10,40,78,0.25)]"
          >
            {note}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
