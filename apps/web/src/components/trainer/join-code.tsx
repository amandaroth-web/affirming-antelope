"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useTransition } from "react";
import { ArrowsClockwise, Check, Copy } from "@phosphor-icons/react";
import { rotateJoinCode } from "@/app/trainer/actions";
import { track } from "@/lib/analytics/client";
import { buttonClass } from "./ui";

/** The join code, big, with copy and rotate. Rotating asks once, inline. */
export function JoinCode({
  cohortId,
  code: initial,
  size = "lg",
  onRotated,
}: {
  cohortId: string;
  code: string;
  size?: "md" | "lg";
  onRotated?: (code: string) => void;
}) {
  const reduce = useReducedMotion();
  const [code, setCode] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [announce, setAnnounce] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      track("join_code_copied");
      setCopied(true);
      setAnnounce(`Copied ${code}`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy. Select the code and copy it by hand.");
    }
  }

  function rotate() {
    setError(null);
    start(async () => {
      const res = await rotateJoinCode(cohortId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCode(res.data.joinCode);
      setConfirming(false);
      setAnnounce(`New join code ${res.data.joinCode}`);
      onRotated?.(res.data.joinCode);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={code}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={`select-all font-display font-bold tracking-[0.08em] text-navy ${size === "lg" ? "text-[44px] leading-none" : "text-[30px] leading-none"}`}
            aria-label={`Join code ${code.split("").join(" ")}`}
          >
            {code}
          </motion.p>
        </AnimatePresence>
        <div className="flex items-center gap-2">
          <button type="button" onClick={copy} className={buttonClass("secondary", "sm")}>
            {copied ? <Check size={16} weight="bold" className="text-[#2e8c7e]" aria-hidden /> : <Copy size={16} weight="bold" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className={buttonClass("ghost", "sm")}>
              <ArrowsClockwise size={16} weight="bold" aria-hidden /> New code
            </button>
          ) : null}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {confirming ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-gold-tint/60 px-4 py-3">
              <p className="flex-1 text-[14px] font-bold text-gold-ink">
                The current code stops working. People already in the cohort stay in.
              </p>
              <button type="button" onClick={rotate} disabled={pending} className={buttonClass("primary", "sm")}>
                {pending ? "Making…" : "Make a new code"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={buttonClass("ghost", "sm")}>
                Keep this one
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {error ? <p className="mt-2 text-[14px] font-bold text-[#a4472a]">{error}</p> : null}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
