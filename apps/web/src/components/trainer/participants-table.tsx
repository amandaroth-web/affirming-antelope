"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { CaretDown, CaretUp, CaretUpDown } from "@phosphor-icons/react";
import { Avatar, Badge, Card, focusRing } from "./ui";

export interface ParticipantRow {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  needsReview: number;
  lastActiveAt: string | null;
  lastActiveLabel: string;
}

type Key = "name" | "assigned" | "completed" | "needsReview" | "lastActiveAt";

const COLUMNS: { key: Key; label: string; align?: "right" }[] = [
  { key: "name", label: "Participant" },
  { key: "assigned", label: "Assigned" },
  { key: "completed", label: "Completed" },
  { key: "needsReview", label: "Needs review" },
  { key: "lastActiveAt", label: "Last active" },
];

export function ParticipantsTable({ cohortId, rows }: { cohortId: string; rows: ParticipantRow[] }) {
  const reduce = useReducedMotion();
  const [sort, setSort] = useState<{ key: Key; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const sorted = useMemo(() => {
    const out = [...rows];
    const { key, dir } = sort;
    const sign = dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      let cmp = 0;
      if (key === "name") cmp = a.name.localeCompare(b.name);
      else if (key === "lastActiveAt") cmp = (a.lastActiveAt ?? "").localeCompare(b.lastActiveAt ?? "");
      else if (key === "completed") cmp = a.completed / (a.assigned || 1) - b.completed / (b.assigned || 1) || a.completed - b.completed;
      else cmp = a[key] - b[key];
      return cmp * sign || a.name.localeCompare(b.name);
    });
    return out;
  }, [rows, sort]);

  function toggle(key: Key) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }

  const needsTotal = rows.reduce((n, r) => n + r.needsReview, 0);

  return (
    <Card className="overflow-hidden" aria-labelledby="participants-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 pt-5 pb-4">
        <h2 id="participants-title" className="font-display text-[19px] font-bold text-ink">
          {rows.length} {rows.length === 1 ? "participant" : "participants"}
        </h2>
        <p className="text-[13px] font-semibold text-muted">Counts cover this cohort&apos;s open assignments.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left whitespace-nowrap">
          <caption className="sr-only">
            Participants, sorted by {COLUMNS.find((c) => c.key === sort.key)?.label} {sort.dir === "asc" ? "ascending" : "descending"}
          </caption>
          <thead>
            <tr className="border-y-2 border-line bg-[#f8f9fe]">
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                const Icon = !active ? CaretUpDown : sort.dir === "asc" ? CaretUp : CaretDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className="px-3 py-1.5 first:pl-4"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-extrabold transition-colors ${active ? "text-ink" : "text-muted hover:text-ink"} ${focusRing}`}
                    >
                      {c.label}
                      <Icon size={14} weight="bold" aria-hidden className={active ? "text-primary" : "text-faint"} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const pct = r.assigned ? Math.min(1, r.completed / r.assigned) : 0;
              const done = r.assigned > 0 && r.completed >= r.assigned;
              return (
                <motion.tr
                  key={r.id}
                  layout={reduce ? false : "position"}
                  transition={{ type: "spring", stiffness: 500, damping: 42 }}
                  className="border-b-2 border-soft last:border-b-0 hover:bg-[#fafbff]"
                >
                  <th scope="row" className="py-3.5 pr-3 pl-6 font-normal">
                    <span className="flex items-center gap-3">
                      <Avatar name={r.name} size={34} />
                      <span className="text-[15px] font-extrabold text-ink">{r.name}</span>
                    </span>
                  </th>
                  <td className="px-4 py-3.5 xl:px-5 text-[15px] font-bold text-ink">
                    {r.assigned ? `${r.assigned} ${r.assigned === 1 ? "practice" : "practices"}` : <span className="text-muted">None</span>}
                  </td>
                  <td className="px-4 py-3.5 xl:px-5">
                    {r.assigned ? (
                      <span className="flex items-center gap-3">
                        <span className="text-[15px] font-bold text-ink">
                          {r.completed} of {r.assigned}
                        </span>
                        <span className="h-2 w-14 overflow-hidden rounded-full bg-soft-deep xl:w-20" aria-hidden>
                          <span
                            className={`block h-full rounded-full ${done ? "bg-[#2e8c7e]" : "bg-primary"}`}
                            style={{ width: `${pct * 100}%` }}
                          />
                        </span>
                      </span>
                    ) : (
                      <span className="text-[15px] font-bold text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 xl:px-5">
                    {r.needsReview ? (
                      <Link href={`/trainer/cohorts/${cohortId}/reviews`} className={`rounded-full ${focusRing}`}>
                        <Badge tone="gold">
                          {r.needsReview} {r.needsReview === 1 ? "submission" : "submissions"}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-[15px] font-bold text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 xl:px-5 text-[15px] font-bold text-ink/80">
                    {r.lastActiveAt ? (
                      <time dateTime={r.lastActiveAt}>
                        {r.lastActiveLabel}
                      </time>
                    ) : (
                      <span className="text-muted">{r.lastActiveLabel}</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {needsTotal ? (
        <p className="border-t-2 border-soft px-6 py-3.5 text-[13px] font-semibold text-muted">
          Learners choose what to send you. You only see role-plays they&apos;ve submitted for review.
        </p>
      ) : null}
    </Card>
  );
}
