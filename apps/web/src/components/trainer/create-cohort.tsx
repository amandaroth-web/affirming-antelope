"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Plus, Stethoscope, UsersThree } from "@phosphor-icons/react";
import { DEFAULT_PATHWAY_ID, listPathways, type Pathway } from "@antelope/core";
import { createCohort } from "@/app/trainer/actions";
import { track } from "@/lib/analytics/client";
import { JoinCode } from "./join-code";
import { Modal } from "./modal";
import { buttonClass } from "./ui";
import { fieldClass, hintClass, labelClass } from "./fields";

const PATHWAY_ICON = { clinical: Stethoscope, workplace: UsersThree } as const;

/** MI for Leaders first and preselected; MI for Clinicians stays one click away. */
function pathwayChoices(): Pathway[] {
  const rank = (p: Pathway) => (p.id === DEFAULT_PATHWAY_ID ? 0 : 1);
  return [...listPathways()].sort((a, b) => rank(a) - rank(b));
}

export function CreateCohortButton({ size = "md", label = "New cohort" }: { size?: "md" | "lg"; label?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [pathwayId, setPathwayId] = useState<string | null>(DEFAULT_PATHWAY_ID);
  const uid = useId();
  const choices = pathwayChoices();
  const chosen = choices.find((p) => p.id === pathwayId);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string; joinCode: string } | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setOpen(false);
    if (created) router.refresh();
    setTimeout(() => {
      setCreated(null);
      setName("");
      setStartsOn("");
      setPathwayId(DEFAULT_PATHWAY_ID);
      setError(null);
    }, 250);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pathwayId) return setError("Choose a pathway for this cohort.");
    start(async () => {
      const res = await createCohort({ name, startsOn: startsOn || null, pathwayId });
      if (!res.ok) setError(res.error);
      else {
        track("cohort_created");
        setCreated(res.data);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary", size)}>
        <Plus size={18} weight="bold" aria-hidden /> {label}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={created ? "Your cohort is ready" : "New cohort"}
        description={
          created
            ? `Share this code with the people in ${created.name}. They enter it in the app to join.`
            : "A cohort is a group of learners you train together on one pathway."
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {created ? (
            <motion.div
              key="done"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <div className="rounded-[20px] bg-soft px-6 py-6">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary-shadow">Join code</p>
                <div className="mt-3">
                  <JoinCode cohortId={created.id} code={created.joinCode} />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={close} className={buttonClass("secondary")}>
                  Done
                </button>
                <Link
                  href={`/trainer/cohorts/${created.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    router.push(`/trainer/cohorts/${created.id}`);
                    router.refresh(); // the rail lists the new cohort
                  }}
                  className={buttonClass("primary")}
                >
                  Open cohort
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={submit} exit={{ opacity: 0 }} className="grid gap-5">
              <fieldset>
                <legend className={labelClass}>Pathway</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {choices.map((p) => {
                    const Icon = PATHWAY_ICON[p.setting];
                    return (
                      <label
                        key={p.id}
                        className="flex cursor-pointer flex-col rounded-2xl border-2 border-line bg-white p-4 transition-colors hover:border-primary-tint has-[:checked]:border-primary has-[:checked]:bg-primary-tint/40 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-primary/40"
                      >
                        <input
                          type="radio"
                          name={`${uid}-pathway`}
                          value={p.id}
                          checked={pathwayId === p.id}
                          onChange={() => setPathwayId(p.id)}
                          className="sr-only"
                        />
                        <span className="flex items-center gap-2.5">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-soft text-primary-shadow">
                            <Icon size={20} weight="bold" aria-hidden />
                          </span>
                          <span className="font-display text-[17px] font-bold leading-tight text-ink">{p.title}</span>
                        </span>
                        <span className="mt-2.5 text-[14px] font-semibold leading-snug text-ink/80">{p.tagline}</span>
                        <span className="mt-2 text-[13px] font-extrabold text-primary-shadow">{p.units.length} weeks</span>
                        <span className="mt-0.5 text-[12px] font-semibold leading-snug text-muted">For {p.audience}</span>
                      </label>
                    );
                  })}
                </div>
                <p className={`${hintClass} mt-2`}>This sets the lessons, drills, and role-plays you can assign. You can't change it later.</p>
              </fieldset>
              <div>
                <label htmlFor="cohort-name" className={labelClass}>
                  Cohort name
                </label>
                <input
                  id="cohort-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  autoFocus
                  placeholder={`${chosen?.title ?? "MI for Leaders"} — Spring cohort`}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="cohort-start" className={labelClass}>
                  Starts on <span className="font-semibold text-muted">(optional)</span>
                </label>
                <input id="cohort-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={`${fieldClass} max-w-[220px]`} />
                <p className={hintClass}>Learners see the pathway either way.</p>
              </div>
              {error ? (
                <p role="alert" className="text-[14px] font-bold text-[#a4472a]">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={close} className={buttonClass("ghost")}>
                  Cancel
                </button>
                <button type="submit" disabled={pending || !name.trim() || !pathwayId} className={buttonClass("primary")}>
                  {pending ? "Creating…" : "Create cohort"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </Modal>
    </>
  );
}
