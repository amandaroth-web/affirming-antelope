"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, CalendarBlank, CheckCircle } from "@phosphor-icons/react";
import { archiveAssignment } from "@/app/trainer/actions";
import type { ItemKind } from "@/lib/trainer/content";
import { ItemIcon } from "./item-icon";
import { Avatar, Badge, buttonClass } from "./ui";

export interface AssignmentView {
  id: string;
  title: string;
  instructions: string;
  dueLabel: string;
  overdue: boolean;
  summary: string;
  items: { id: string; kind: ItemKind; title: string; detail: string; quantity: number }[];
  learners: { id: string; name: string; done: number; total: number }[];
}

export function AssignmentCard({ cohortId, a, highlight }: { cohortId: string; a: AssignmentView; highlight?: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const finished = a.learners.filter((l) => l.total && l.done >= l.total).length;

  return (
    <motion.article
      aria-labelledby={`a-${a.id}`}
      initial={highlight && !reduce ? { boxShadow: "0 0 0 4px rgba(79,107,237,0.35), 0 5px 0 var(--shadow)" } : false}
      animate={{ boxShadow: "0 0 0 0px rgba(79,107,237,0), 0 5px 0 var(--shadow)" }}
      transition={{ duration: 1.6, delay: 0.6 }}
      className="rounded-[20px] border-2 border-line bg-white"
    >
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={a.overdue ? "clay" : "primary"}>
              <CalendarBlank size={13} weight="bold" aria-hidden /> {a.dueLabel}
            </Badge>
            {highlight ? <Badge tone="teal">Just published</Badge> : null}
            {!confirm ? (
              <button type="button" className={buttonClass("ghost", "sm", "ml-auto -mr-2 -my-1")} onClick={() => setConfirm(true)} aria-label={`Archive ${a.title}`}>
                <Archive size={15} weight="bold" aria-hidden /> Archive
              </button>
            ) : null}
          </div>
          <h3 id={`a-${a.id}`} className="mt-3 font-display text-[21px] font-bold leading-tight text-ink">
            {a.title}
          </h3>
          <p className="mt-1 text-[14px] font-bold text-primary-shadow">{a.summary}</p>
          {a.instructions ? <p className="mt-3 max-w-[60ch] whitespace-pre-line text-[15px] font-semibold leading-relaxed text-ink/80">{a.instructions}</p> : null}
          <ul className="mt-5 grid gap-2.5">
            {a.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <ItemIcon kind={i.kind} size={16} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-extrabold text-ink">{i.title}</span>
                  <span className="block truncate text-[13px] font-semibold text-muted">{i.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 rounded-2xl bg-[#f8f9fe] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-[14px] font-extrabold text-ink">Progress</h4>
            <p className="text-[13px] font-bold text-muted">
              {a.learners.length ? `${finished} of ${a.learners.length} finished` : "No learners yet"}
            </p>
          </div>
          <ul className="mt-3 grid gap-2.5">
            {a.learners.map((l, idx) => {
              const pct = l.total ? Math.min(1, l.done / l.total) : 0;
              const done = l.total > 0 && l.done >= l.total;
              return (
                <li key={l.id} className="flex items-center gap-3">
                  <Avatar name={l.name} size={28} />
                  <span className="w-24 truncate text-[14px] font-extrabold text-ink">{l.name}</span>
                  <span
                    className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-soft-deep"
                    role="progressbar"
                    aria-label={`${l.name}: ${l.done} of ${l.total} done`}
                    aria-valuemin={0}
                    aria-valuemax={l.total}
                    aria-valuenow={l.done}
                  >
                    <motion.span
                      className={`absolute inset-y-0 left-0 rounded-full ${done ? "bg-[#2e8c7e]" : "bg-primary"}`}
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${pct * 100}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.15 + idx * 0.05 }}
                    />
                  </span>
                  <span className="flex w-16 items-center justify-end gap-1 text-[13px] font-extrabold text-ink/80">
                    {done ? <CheckCircle size={16} weight="fill" className="text-[#2e8c7e]" aria-hidden /> : null}
                    {l.done}/{l.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {confirm ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t-2 border-soft px-6 py-3">
          <span className="mr-auto text-[13px] font-bold text-muted">Learners stop seeing it. Their practice stays.</span>
          <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setConfirm(false)}>
            Keep
          </button>
          <button
            type="button"
            disabled={pending}
            className={buttonClass("secondary", "sm")}
            onClick={() =>
              start(async () => {
                const r = await archiveAssignment(a.id, cohortId);
                if (r.ok) router.refresh();
              })
            }
          >
            {pending ? "Archiving…" : "Archive assignment"}
          </button>
        </div>
      ) : null}
    </motion.article>
  );
}
