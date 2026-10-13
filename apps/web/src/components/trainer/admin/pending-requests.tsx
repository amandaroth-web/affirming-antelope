"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useTransition } from "react";
import { Buildings, Check, UsersThree, X } from "@phosphor-icons/react";
import { approveTrainerRequest, declineTrainerRequest } from "@/app/trainer/admin/actions";
import { track } from "@/lib/analytics/client";
import { Avatar, buttonClass } from "../ui";

export interface PendingRequestRow {
  id: string;
  name: string;
  email: string;
  organization: string;
  learners: string;
  note: string | null;
  age: string;
}

function RequestCard({ r }: { r: PendingRequestRow }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(kind: "approve" | "decline") {
    setError(null);
    setBusy(kind);
    start(async () => {
      const res = kind === "approve" ? await approveTrainerRequest(r.id) : await declineTrainerRequest(r.id);
      setBusy(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (kind === "approve") track("trainer_access_approved", { request_id: r.id });
    });
  }

  return (
    <div className="rounded-[20px] border-2 border-line bg-white p-5 shadow-[0_4px_0_var(--shadow)] sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={r.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h3 className="font-display text-[19px] font-bold leading-tight text-ink">{r.name}</h3>
            <span className="text-[13px] font-bold text-muted">{r.age}</span>
          </div>
          <p className="mt-0.5 break-all text-[14px] font-semibold text-muted">{r.email}</p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            <div className="flex items-center gap-1.5">
              <dt className="text-muted">
                <Buildings size={16} weight="bold" aria-hidden />
                <span className="sr-only">Organization</span>
              </dt>
              <dd className="font-extrabold text-ink">{r.organization}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted">
                <UsersThree size={16} weight="bold" aria-hidden />
                <span className="sr-only">Learners</span>
              </dt>
              <dd className="font-extrabold text-ink">{r.learners} learners</dd>
            </div>
          </dl>
          {r.note ? (
            <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-soft/70 px-4 py-3 text-[14px] font-semibold leading-relaxed text-ink/85">
              {r.note}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-col sm:items-stretch">
          {confirmDecline ? (
            <>
              <button type="button" disabled={pending} onClick={() => run("decline")} className={buttonClass("danger", "sm")}>
                {busy === "decline" ? "Declining…" : "Yes, decline"}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirmDecline(false)} className={buttonClass("ghost", "sm")}>
                Keep it
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={pending} onClick={() => run("approve")} className={buttonClass("primary", "sm")}>
                <Check size={16} weight="bold" aria-hidden />
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirmDecline(true)} className={buttonClass("secondary", "sm")}>
                <X size={16} weight="bold" aria-hidden />
                Decline
              </button>
            </>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[14px] font-bold text-[#a4472a]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PendingRequests({ requests }: { requests: PendingRequestRow[] }) {
  const reduce = useReducedMotion();
  return (
    <ul className="mt-4 grid gap-4">
      <AnimatePresence initial={false}>
        {requests.map((r) => (
          <motion.li
            key={r.id}
            layout={!reduce}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.2 } }}
          >
            <RequestCard r={r} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
