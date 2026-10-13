"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { requestTrainerAccess, type RequestAccessResult } from "@/app/trainer/actions";
import { track } from "@/lib/analytics/client";
import { LEARNER_COUNTS, NAME_MAX, NOTE_MAX, ORGANIZATION_MAX } from "@/lib/trainer/access";
import { buttonClass } from "./ui";
import { fieldClass, hintClass, labelClass } from "./fields";

/** The primary path on "Become a trainer": ask, and an admin approves. */
export function RequestAccessForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<RequestAccessResult | null, FormData>(requestTrainerAccess, null);
  const error = state && !state.ok ? state.error : null;
  // Controlled, so React's post-action form reset doesn't wipe what they typed.
  const [name, setName] = useState(defaultName);
  const [organization, setOrganization] = useState("");
  const [learnerCount, setLearnerCount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!state?.ok) return;
    track("trainer_access_requested", { request_id: state.data.requestId, learner_count: state.data.learnerCount });
    // The page shows the pending request on its next render.
    router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-7 grid gap-5" aria-describedby={error ? "request-error" : undefined}>
      <div>
        <label htmlFor="name" className={labelClass}>
          Your name, as learners will see it
        </label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={NAME_MAX}
          autoComplete="name"
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="organization" className={labelClass}>
          Organization or team
        </label>
        <input
          id="organization"
          name="organization"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          required
          maxLength={ORGANIZATION_MAX}
          autoComplete="organization"
          placeholder="Northside Health, leadership program"
          className={fieldClass}
        />
      </div>
      <fieldset>
        <legend className={labelClass}>About how many learners?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEARNER_COUNTS.map((c) => (
            <label key={c.value} className="relative">
              <input
                type="radio"
                name="learnerCount"
                value={c.value}
                checked={learnerCount === c.value}
                onChange={() => setLearnerCount(c.value)}
                required
                className="peer sr-only"
              />
              <span className="flex min-h-11 cursor-pointer select-none items-center justify-center rounded-2xl border-2 border-line bg-white px-3 text-[15px] font-extrabold text-ink shadow-[0_3px_0_var(--shadow)] transition-[transform,box-shadow,border-color,background-color] duration-75 hover:border-primary-tint active:translate-y-[3px] active:shadow-none peer-checked:border-primary peer-checked:bg-primary-tint/40 peer-checked:text-primary-shadow peer-checked:shadow-[0_3px_0_var(--primary-tint)] peer-focus-visible:ring-[3px] peer-focus-visible:ring-primary/40">
                {c.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="note" className={labelClass}>
          Anything we should know? <span className="font-semibold text-muted">(optional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          placeholder="Who you train, or when your cohort starts"
          className={`${fieldClass} resize-y`}
        />
        <p className={hintClass}>
          {note.length > NOTE_MAX - 80 ? `${NOTE_MAX - note.length} characters left` : "A sentence or two is plenty."}
        </p>
      </div>
      <div aria-live="polite" id="request-error">
        <AnimatePresence>
          {error ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden text-[14px] font-bold text-[#a4472a]"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-fit")}>
        {pending ? "Sending…" : "Request trainer access"}
      </button>
    </form>
  );
}
