"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useTransition } from "react";
import { Check, Copy, Plus } from "@phosphor-icons/react";
import { createTrainerCode, type NewTrainerCode } from "@/app/trainer/admin/actions";
import { Card, buttonClass } from "../ui";
import { fieldClass, hintClass, labelClass } from "../fields";

function NewCode({ created, onDone }: { created: NewTrainerCode; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(created.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopyError(true);
    }
  }

  const limits = [
    created.maxUses ? `${created.maxUses} ${created.maxUses === 1 ? "use" : "uses"}` : "Unlimited uses",
    created.expiresAt
      ? `expires ${new Date(created.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
      : "never expires",
  ].join(", ");

  return (
    <div className="rounded-[20px] border-2 border-primary-tint bg-soft/70 p-5 sm:p-6">
      <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary-shadow">New trainer code</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="select-all font-display text-[34px] font-bold leading-none tracking-[0.06em] text-navy" data-testid="new-trainer-code">
          {created.code}
        </p>
        <button type="button" onClick={copy} className={buttonClass("secondary", "sm")}>
          {copied ? <Check size={16} weight="bold" className="text-[#2e8c7e]" aria-hidden /> : <Copy size={16} weight="bold" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-[14px] font-semibold text-muted">
        {limits}. Send it to the trainer; they enter it under &ldquo;Have a trainer code?&rdquo; after signing in.
      </p>
      {copyError ? <p className="mt-2 text-[14px] font-bold text-[#a4472a]">Couldn&apos;t copy. Select the code and copy it by hand.</p> : null}
      <span aria-live="polite" className="sr-only">
        {copied ? `Copied ${created.code}` : ""}
      </span>
      <button type="button" onClick={onDone} className={buttonClass("ghost", "sm", "mt-3 -ml-3")}>
        Done
      </button>
    </div>
  );
}

export function CreateTrainerCode() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [suffix, setSuffix] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<NewTrainerCode | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createTrainerCode({
        suffix,
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        expiresOn: expiresOn || null,
        note,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCreated(res.data);
      setOpen(false);
      setSuffix("");
      setMaxUses("1");
      setExpiresOn("");
      setNote("");
    });
  }

  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: -8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="mt-4">
      <AnimatePresence mode="wait" initial={false}>
        {created ? (
          <motion.div key="created" {...motionProps}>
            <NewCode created={created} onDone={() => setCreated(null)} />
          </motion.div>
        ) : open ? (
          <motion.div key="form" {...motionProps}>
            <Card depth="md" className="p-5 sm:p-6">
              <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="code-suffix" className={labelClass}>
                    Code <span className="font-semibold text-muted">(optional)</span>
                  </label>
                  <div className="mt-2 flex items-stretch overflow-hidden rounded-2xl border-2 border-line bg-white focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/25">
                    <span className="flex items-center bg-soft px-3 font-display text-[16px] font-bold tracking-[0.06em] text-navy">TRAIN-</span>
                    <input
                      id="code-suffix"
                      value={suffix}
                      onChange={(e) => setSuffix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))}
                      placeholder="Random"
                      autoComplete="off"
                      spellCheck={false}
                      className="min-w-0 flex-1 px-3 py-2.5 font-display text-[16px] font-bold uppercase tracking-[0.06em] text-ink placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-faint focus:outline-none"
                    />
                  </div>
                  <p className={hintClass}>Leave blank for 6 random characters.</p>
                </div>
                <div>
                  <label htmlFor="code-note" className={labelClass}>
                    Note <span className="font-semibold text-muted">(optional)</span>
                  </label>
                  <input
                    id="code-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={200}
                    placeholder="Who it's for"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="code-max-uses" className={labelClass}>
                    Max uses
                  </label>
                  <input
                    id="code-max-uses"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10000}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className={fieldClass}
                  />
                  <p className={hintClass}>Blank for no limit.</p>
                </div>
                <div>
                  <label htmlFor="code-expires" className={labelClass}>
                    Expires <span className="font-semibold text-muted">(optional)</span>
                  </label>
                  <input
                    id="code-expires"
                    type="date"
                    value={expiresOn}
                    onChange={(e) => setExpiresOn(e.target.value)}
                    className={fieldClass}
                  />
                  <p className={hintClass}>Works through the end of that day (UTC).</p>
                </div>
                {error ? (
                  <p role="alert" className="text-[14px] font-bold text-[#a4472a] md:col-span-2">
                    {error}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button type="submit" disabled={pending} className={buttonClass("primary")}>
                    {pending ? "Creating…" : "Create code"}
                  </button>
                  <button type="button" disabled={pending} onClick={() => setOpen(false)} className={buttonClass("ghost")}>
                    Cancel
                  </button>
                </div>
              </form>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="button" {...motionProps}>
            <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
              <Plus size={16} weight="bold" aria-hidden /> Create code
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
