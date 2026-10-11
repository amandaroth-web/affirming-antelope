"use client";

import { AnimatePresence, motion } from "motion/react";
import { useActionState, useState } from "react";
import { claimTrainer, type ActionResult } from "@/app/trainer/actions";
import { buttonClass } from "./ui";
import { fieldClass, labelClass } from "./fields";

export function BecomeTrainerForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(claimTrainer, null);
  const error = state && !state.ok ? state.error : null;
  // Controlled, so React's post-action form reset doesn't wipe what they typed.
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState("");

  return (
    <form action={action} className="mt-8 grid gap-5">
      <div>
        <label htmlFor="displayName" className={labelClass}>
          Your name, as learners will see it
        </label>
        <input id="displayName" name="displayName" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="code" className={labelClass}>
          Trainer code
        </label>
        <input
          id="code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="TRAIN-XXXX"
          aria-invalid={!!error}
          aria-describedby={error ? "code-error" : undefined}
          className={`${fieldClass} font-display text-[20px] uppercase tracking-[0.12em] placeholder:tracking-[0.12em]`}
        />
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
      </div>
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-fit")}>
        {pending ? "Checking…" : "Unlock trainer tools"}
      </button>
    </form>
  );
}
