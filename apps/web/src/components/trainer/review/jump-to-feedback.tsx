"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowDown } from "@phosphor-icons/react";

/** Below xl the feedback panel sits after the transcript; this jumps to it and hides once it's on screen. */
export function JumpToFeedback({ label }: { label: string }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);
  useEffect(() => {
    const el = document.getElementById("feedback");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <AnimatePresence>
      {show ? (
        <motion.a
          href="#feedback"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="fixed right-6 bottom-6 z-20 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[14px] font-extrabold tracking-wide text-white uppercase shadow-[0_4px_0_var(--primary-shadow)] active:translate-y-[4px] active:shadow-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/45 focus-visible:ring-offset-2 xl:hidden"
        >
          {label} <ArrowDown size={16} weight="bold" aria-hidden />
        </motion.a>
      ) : null}
    </AnimatePresence>
  );
}
