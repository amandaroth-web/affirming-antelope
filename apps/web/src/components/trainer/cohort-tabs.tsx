"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

export function CohortTabs({ cohortId, needsReview }: { cohortId: string; needsReview: number }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const base = `/trainer/cohorts/${cohortId}`;
  const tabs = [
    { href: base, label: "Participants", active: path === base },
    { href: `${base}/assignments`, label: "Assignments", active: path.startsWith(`${base}/assignments`) },
    { href: `${base}/reviews`, label: "Reviews", active: path.startsWith(`${base}/reviews`), count: needsReview },
  ];
  return (
    <nav aria-label="Cohort sections" className="mt-6 border-b-2 border-line">
      <ul className="-mb-[2px] flex gap-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`relative flex items-center gap-2 rounded-t-xl px-4 pt-2 pb-3 text-[15px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40 ${t.active ? "text-primary-shadow" : "text-muted hover:text-ink"}`}
            >
              {t.label}
              {t.count ? (
                <span className="rounded-full bg-gold-tint px-2 py-0.5 text-[12px] font-extrabold text-gold-ink" aria-label={`${t.count} need review`}>
                  {t.count}
                </span>
              ) : null}
              {t.active ? (
                <motion.span
                  layoutId="cohort-tab"
                  className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
                />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
