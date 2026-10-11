"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { focusRing } from "./ui";

const FILTERS = [
  { id: "submitted", label: "Needs review" },
  { id: "reviewed", label: "Reviewed" },
  { id: "all", label: "All" },
] as const;

export function QueueControls({
  status,
  sort,
  counts,
}: {
  status: "submitted" | "reviewed" | "all";
  sort: "newest" | "oldest";
  counts: Record<"submitted" | "reviewed" | "all", number>;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    return `${path}?${p.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Filter by status" className="flex gap-1 rounded-2xl bg-soft p-1">
        {FILTERS.map((f) => {
          const active = status === f.id;
          return (
            <Link
              key={f.id}
              href={href({ status: f.id })}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={`relative rounded-xl px-3.5 py-1.5 text-[14px] font-extrabold transition-colors ${focusRing} ${active ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {active ? (
                <motion.span
                  layoutId="queue-filter"
                  className="absolute inset-0 rounded-xl bg-white shadow-[0_2px_0_var(--shadow)]"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                />
              ) : null}
              <span className="relative">
                {f.label} <span className="text-muted">{counts[f.id]}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <label className="flex items-center gap-2 text-[14px] font-extrabold text-muted">
        Sort
        <select
          value={sort}
          onChange={(e) => router.replace(href({ sort: e.target.value }), { scroll: false })}
          className={`rounded-xl border-2 border-line bg-white px-3 py-1.5 text-[14px] font-extrabold text-ink ${focusRing}`}
        >
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </select>
      </label>
    </div>
  );
}
