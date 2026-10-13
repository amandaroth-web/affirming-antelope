"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck, SquaresFour } from "@phosphor-icons/react";

export interface RailCohort {
  id: string;
  name: string;
  needsReview: number;
}

const item =
  "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40";

export function RailNav({ cohorts, isAdmin = false }: { cohorts: RailCohort[]; isAdmin?: boolean }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const homeActive = path === "/trainer";
  const adminActive = path.startsWith("/trainer/admin");

  const pill = (
    <motion.span
      layoutId="rail-active"
      className="absolute inset-0 -z-10 rounded-2xl border-2 border-line bg-white shadow-[0_3px_0_var(--shadow)]"
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
    />
  );

  return (
    <nav aria-label="Trainer" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4">
      <ul className="isolate">
        <li>
          <Link href="/trainer" aria-current={homeActive ? "page" : undefined} className={`${item} ${homeActive ? "text-ink" : "text-ink/70 hover:text-ink"}`}>
            {homeActive ? pill : null}
            <SquaresFour size={20} weight="bold" className={homeActive ? "text-primary" : "text-muted"} aria-hidden />
            All cohorts
          </Link>
        </li>
        {isAdmin ? (
          <li>
            <Link
              href="/trainer/admin"
              aria-current={adminActive ? "page" : undefined}
              className={`${item} ${adminActive ? "text-ink" : "text-ink/70 hover:text-ink"}`}
            >
              {adminActive ? pill : null}
              <ShieldCheck size={20} weight="bold" className={adminActive ? "text-primary" : "text-muted"} aria-hidden />
              Admin
            </Link>
          </li>
        ) : null}
      </ul>
      <div>
        <p className="px-3 pb-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">Your cohorts</p>
        {cohorts.length ? (
          <ul className="isolate grid grid-cols-[minmax(0,1fr)] gap-1">
            {cohorts.map((c) => {
              const active = path.startsWith(`/trainer/cohorts/${c.id}`);
              return (
                <li key={c.id}>
                  <Link
                    href={`/trainer/cohorts/${c.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`${item} ${active ? "text-ink" : "text-ink/70 hover:text-ink"}`}
                  >
                    {active ? pill : null}
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-display text-[13px] font-bold ${active ? "bg-primary text-white" : "bg-soft-deep text-primary-shadow"}`}
                    >
                      {c.name.trim()[0]?.toUpperCase()}
                    </span>
                    <span className="line-clamp-2 min-w-0 flex-1 leading-tight">{c.name}</span>
                    {c.needsReview ? (
                      <span
                        className="rounded-full bg-gold-tint px-2 py-0.5 text-[12px] font-extrabold text-gold-ink"
                        aria-label={`${c.needsReview} ${c.needsReview === 1 ? "submission needs" : "submissions need"} review`}
                      >
                        {c.needsReview}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 text-[13px] font-semibold text-muted">No cohorts yet.</p>
        )}
      </div>
    </nav>
  );
}
