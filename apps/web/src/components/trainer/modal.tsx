"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { buttonClass } from "./ui";

/**
 * Native <dialog> (focus trap, Esc, inert background) with Motion on enter and exit.
 * The dialog stays mounted; closing animates out first, then calls close().
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const reduce = useReducedMotion();
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-visible bg-transparent p-0 backdrop:bg-transparent"
      style={{ maxWidth: width }}
    >
      <AnimatePresence onExitComplete={() => ref.current?.close()}>
        {open ? (
          <>
            <motion.div
              key="scrim"
              aria-hidden
              className="fixed inset-0 -z-10 bg-[var(--scrim)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
            />
            <motion.div
              key="panel"
              className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[24px] border-2 border-line bg-white p-7 shadow-[0_6px_0_var(--shadow)]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
              transition={reduce ? { duration: 0.12 } : { type: "spring", stiffness: 380, damping: 30 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id={titleId} className="font-display text-[24px] font-bold leading-tight text-ink">
                    {title}
                  </h2>
                  {description ? (
                    <p id={descId} className="mt-1.5 text-[15px] font-semibold leading-relaxed text-muted">
                      {description}
                    </p>
                  ) : null}
                </div>
                <button type="button" onClick={onClose} className={buttonClass("ghost", "sm", "-mr-2 -mt-1 !px-2")} aria-label="Close">
                  <X size={18} weight="bold" aria-hidden />
                </button>
              </div>
              <div className="mt-6">{children}</div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </dialog>
  );
}
