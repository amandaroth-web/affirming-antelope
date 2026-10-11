"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArrowCounterClockwise } from "@phosphor-icons/react";
import { setCohortArchived } from "@/app/trainer/actions";
import { Modal } from "./modal";
import { buttonClass } from "./ui";

export function ArchiveCohort({ cohortId, archived }: { cohortId: string; archived: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(next: boolean) {
    setError(null);
    start(async () => {
      const res = await setCohortArchived(cohortId, next);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (archived) {
    return (
      <button type="button" onClick={() => run(false)} disabled={pending} className={buttonClass("secondary", "sm")}>
        <ArrowCounterClockwise size={16} weight="bold" aria-hidden /> {pending ? "Restoring…" : "Restore cohort"}
      </button>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("ghost", "sm")}>
        <Archive size={16} weight="bold" aria-hidden /> Archive
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Archive this cohort?"
        description="The join code stops working and the cohort leaves your list. Learners keep their practice history, and you can restore it any time."
      >
        {error ? (
          <p role="alert" className="mb-4 text-[14px] font-bold text-[#a4472a]">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
            Cancel
          </button>
          <button type="button" onClick={() => run(true)} disabled={pending} className={buttonClass("primary")}>
            {pending ? "Archiving…" : "Archive cohort"}
          </button>
        </div>
      </Modal>
    </>
  );
}
