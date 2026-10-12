"use client";

import { motion, useReducedMotion } from "motion/react";
import { Hoofprint } from "./hoofprint";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Index into DAYS of "today". Days before it are done, days after are ahead. */
const TODAY = 4;
const STREAK = 12;

export function StreakCard() {
  const reduce = useReducedMotion();

  return (
    <div
      role="img"
      aria-label={`${STREAK}-day practice streak. Five of seven days done this week, today's session is next.`}
      className="mx-auto w-full max-w-[20rem] rounded-[1.75rem] border-2 border-line bg-soft p-5 shadow-[0_6px_0_var(--shadow)]"
    >
      <div className="flex items-center gap-4">
        <motion.div
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-2xl border-2 border-gold-shadow bg-gold shadow-[0_4px_0_var(--gold-shadow)]"
          initial={reduce ? false : { scale: 0.6, rotate: -12, opacity: 0 }}
          whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
        >
          <Hoofprint className="size-8" fill="#fff" />
        </motion.div>
        <div>
          <p className="font-display text-4xl font-bold leading-none text-ink">
            {STREAK}
            <span className="ml-1.5 text-xl text-muted">days</span>
          </p>
          <p className="mt-1 text-sm font-extrabold text-primary-shadow">
            Streak going strong
          </p>
        </div>
      </div>

      <ol aria-hidden className="mt-5 grid grid-cols-7 gap-1.5">
        {DAYS.map((label, i) => {
          const done = i < TODAY;
          const today = i === TODAY;
          return (
            <motion.li
              key={i}
              className="flex flex-col items-center gap-1.5"
              initial={reduce ? false : { y: 10, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{
                type: "spring",
                stiffness: 220,
                damping: 16,
                delay: 0.2 + i * 0.06,
              }}
            >
              <span
                className={[
                  "grid size-8 place-items-center rounded-xl border-2 text-sm font-extrabold",
                  done &&
                    "border-gold-shadow bg-gold text-white shadow-[0_3px_0_var(--gold-shadow)]",
                  today &&
                    "border-primary-shadow bg-primary text-white shadow-[0_3px_0_var(--primary-shadow)]",
                  !done &&
                    !today &&
                    "border-line bg-white text-muted shadow-[0_3px_0_var(--shadow)]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {done ? <Check /> : today ? <Dot pulse={!reduce} /> : null}
              </span>
              <span
                className={
                  "text-[0.7rem] font-extrabold " +
                  (today ? "text-primary-shadow" : "text-muted")
                }
              >
                {label}
              </span>
            </motion.li>
          );
        })}
      </ol>

      <div className="mt-5 flex items-center justify-between rounded-2xl border-2 border-line bg-white px-4 py-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Up next
          </p>
          <p className="font-display text-base font-bold text-ink">
            Reflections, set 3
          </p>
        </div>
        <span className="rounded-lg bg-soft px-2.5 py-1 text-sm font-extrabold text-primary-shadow">
          4 min
        </span>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
      <path
        d="M3 8.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Dot({ pulse }: { pulse: boolean }) {
  return (
    <motion.span
      className="block size-2 rounded-full bg-white"
      animate={pulse ? { scale: [1, 1.5, 1] } : undefined}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
