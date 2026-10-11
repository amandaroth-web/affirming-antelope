"use client";

import { Check, LockSimple } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { Drill, PathUnit } from "@antelope/core";

const spring = { type: "spring", stiffness: 220, damping: 20 } as const;

const card =
  "mx-auto w-full max-w-[26rem] rounded-[2rem] border-2 border-line bg-white p-5 shadow-[0_6px_0_var(--shadow)] md:p-6";

/** A real drill from @antelope/core, playing itself: the target answer lights up. */
export function DrillShowcase({ drill }: { drill: Drill }) {
  const reduce = useReducedMotion();
  const choices = drill.choices ?? [];
  const target = choices.find((c) => c.isTarget);
  const pick = reduce ? false : { opacity: 0, y: 12 };

  return (
    <div className={card}>
      <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
        Sample drill · OARS
      </p>
      <p className="mt-1 text-sm font-bold text-muted">{drill.context}</p>
      <motion.blockquote
        className="mt-4 rounded-2xl rounded-tl-md border-2 border-line bg-soft px-4 py-3 font-bold leading-snug text-ink shadow-[0_3px_0_var(--shadow)]"
        initial={pick}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.15 }}
      >
        <span className="block text-xs font-extrabold text-primary-shadow">{drill.speaker}</span>
        {drill.prompt}
      </motion.blockquote>
      <p className="mt-4 font-display font-bold text-ink">{drill.instruction}</p>
      <ul className="mt-3 space-y-2">
        {choices.map((choice, i) => {
          const hit = choice.isTarget;
          return (
            <motion.li
              key={choice.text}
              initial={pick}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.3 + i * 0.08 }}
            >
              <motion.div
                className="flex items-start gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-[15px] font-bold leading-snug"
                initial={reduce ? false : { borderColor: "#dfe3f2", backgroundColor: "#ffffff" }}
                animate={
                  hit
                    ? { borderColor: "#4f6bed", backgroundColor: "#eef1ff" }
                    : { borderColor: "#dfe3f2", backgroundColor: "#ffffff" }
                }
                transition={{ duration: 0.25, delay: reduce ? 0 : 1.3 }}
              >
                <span
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                    hit ? "border-primary bg-primary text-white" : "border-line"
                  }`}
                >
                  {hit && <Check size={12} weight="bold" aria-hidden />}
                </span>
                <span className="text-ink">{choice.text}</span>
              </motion.div>
            </motion.li>
          );
        })}
      </ul>
      {target && (
        <motion.p
          className="mt-4 rounded-2xl bg-gold-tint px-4 py-3 text-sm font-bold leading-snug text-gold-ink"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: reduce ? 0 : 1.55 }}
        >
          {target.explanation}
        </motion.p>
      )}
    </div>
  );
}

/** The first weeks of MI for Leaders, from @antelope/core. */
export function PathwayShowcase({ units, total }: { units: PathUnit[]; total: number }) {
  const reduce = useReducedMotion();
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
          MI for Leaders
        </p>
        <p className="text-sm font-extrabold text-muted">{total} weeks</p>
      </div>
      <ol className="mt-4 space-y-2.5">
        {units.map((unit, i) => {
          const done = i < 2;
          const current = i === 2;
          return (
            <motion.li
              key={unit.id}
              className={`flex items-center gap-3 rounded-2xl border-2 px-3.5 py-3 ${
                current ? "border-primary bg-soft shadow-[0_4px_0_var(--primary-tint)]" : "border-line bg-white"
              }`}
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.15 + i * 0.08 }}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-lg font-bold ${
                  done
                    ? "bg-gold text-ink shadow-[0_3px_0_var(--gold-shadow)]"
                    : current
                      ? "bg-primary text-primary-ink shadow-[0_3px_0_var(--primary-shadow)]"
                      : "bg-soft text-faint"
                }`}
              >
                {done ? <Check size={18} weight="bold" aria-hidden /> : unit.week}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-display font-bold ${i > 2 ? "text-muted" : "text-ink"}`}>
                  Week {unit.week}: {unit.title}
                </span>
                <span className={`block truncate text-sm font-semibold ${current ? "text-ink/80" : "text-muted"}`}>{unit.subtitle}</span>
                {current && (
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white">
                    <motion.span
                      className="block h-full rounded-full bg-primary"
                      initial={reduce ? false : { width: "0%" }}
                      animate={{ width: "55%" }}
                      transition={{ duration: 0.9, ease: "easeOut", delay: reduce ? 0 : 0.8 }}
                    />
                  </span>
                )}
              </span>
              {i > 2 && <LockSimple size={16} weight="bold" className="shrink-0 text-faint" aria-hidden />}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

const people = [
  { name: "Priya S.", done: 5, of: 6, review: true },
  { name: "Marcus L.", done: 3, of: 6, review: false },
  { name: "Dana R.", done: 6, of: 6, review: true },
  { name: "Joel K.", done: 1, of: 6, review: false },
];

/** An illustration of the trainer dashboard's participants view. */
export function CohortShowcase() {
  const reduce = useReducedMotion();
  return (
    <div
      className={card}
      role="img"
      aria-label="Illustration of the trainer dashboard: a cohort's join code and four participants with their completed practice and submissions to review."
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">Cohort</p>
          <p className="font-display text-xl font-bold text-ink">Spring MI cohort</p>
        </div>
        <span className="rounded-xl border-2 border-dashed border-primary-tint bg-soft px-3 py-1.5 font-display text-lg font-bold tracking-[0.12em] text-primary-shadow">
          K7Q-4ZP
        </span>
      </div>
      <motion.p
        className="mt-4 rounded-2xl bg-gold-tint px-4 py-2.5 text-sm font-extrabold text-gold-ink"
        initial={reduce ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 1.2 }}
      >
        2 role-plays need review
      </motion.p>
      <ul className="mt-4 divide-y-2 divide-soft">
        {people.map((p, i) => (
          <li key={p.name} className="flex items-center gap-3 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-soft font-display font-bold text-primary-shadow">
              {p.name[0]}
            </span>
            <span className="w-20 shrink-0 font-bold text-ink">{p.name}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-soft">
              <motion.span
                className={`block h-full rounded-full ${p.done === p.of ? "bg-gold" : "bg-primary"}`}
                initial={reduce ? false : { width: "0%" }}
                animate={{ width: `${(p.done / p.of) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: reduce ? 0 : 0.3 + i * 0.1 }}
              />
            </span>
            <span className="w-9 shrink-0 text-right text-sm font-extrabold text-muted">
              {p.done}/{p.of}
            </span>
            <span
              className={`size-2.5 shrink-0 rounded-full ${p.review ? "bg-gold" : "bg-transparent"}`}
              aria-hidden
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
