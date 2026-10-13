"use client";

import { AnimatePresence, motion } from "motion/react";
import { useActionState, useState } from "react";
import { claimTrainer, type ActionResult } from "@/app/trainer/actions";
import { buttonClass } from "./ui";
import { fieldClass } from "./fields";

/** The secondary path on "Become a trainer": a code from a program lead (bulk invites). */
export function TrainerCodeForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(claimTrainer, null);
  const error = state && !state.ok ? state.error : null;
  // Controlled, so React's post-action form reset doesn't wipe what they typed.
  const [code, setCode] = useState("");

  return (
    <form action={action}>
      <label htmlFor="code" className="block text-[15px] font-extrabold text-ink">
        Have a trainer code?
      </label>
      <p className="mt-0.5 text-[14px] font-semibold text-muted">If your program lead sent you one, it unlocks the trainer tools right away.</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <input
          id="code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="TRAIN-XXXXXX"
          aria-invalid={!!error}
          aria-describedby={error ? "code-error" : undefined}
          className={`${fieldClass} !mt-0 font-display text-[18px] uppercase tracking-[0.1em] placeholder:tracking-[0.1em] sm:max-w-[260px]`}
        />
        <button type="submit" disabled={pending} className={buttonClass("secondary", "lg")}>
          {pending ? "Checking…" : "Use code"}
        </button>
      </div>
      <div aria-live="polite" id="code-error">
        <AnimatePresence>
          {error ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden pt-2.5 text-[14px] font-bold text-[#a4472a]"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </form>
  );
}
