import type { ReactNode } from "react";

export const h2Class = "pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl";

/** A line from the other person in a role-play. */
export function TheirLine({ who, initials, children }: { who: string; initials: string; children: ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-soft-deep text-[11px] font-extrabold text-primary-shadow"
      >
        {initials}
      </span>
      <p className="max-w-[85%] rounded-[1.1rem] rounded-bl-md border-2 border-line bg-white px-3.5 py-2.5 font-semibold leading-snug text-ink shadow-[0_3px_0_var(--shadow)]">
        <span className="sr-only">{who}: </span>
        {children}
      </p>
    </div>
  );
}

/** A line the learner says. */
export function YourLine({ children }: { children: ReactNode }) {
  return (
    <p className="ml-auto max-w-[85%] rounded-[1.1rem] rounded-br-md bg-primary px-3.5 py-2.5 font-semibold leading-snug text-primary-ink shadow-[0_3px_0_var(--primary-shadow)]">
      <span className="sr-only">You: </span>
      {children}
    </p>
  );
}

/** A coach's margin note on the exchange above it, marked the way the debrief marks moves. */
export function CoachNote({ tone, children }: { tone: "shuts" | "opens"; children: ReactNode }) {
  return (
    <p
      className={`flex items-start gap-2 text-[15px] font-extrabold leading-snug ${
        tone === "shuts" ? "text-[color:var(--move-inconsistent-ink)]" : "text-[color:var(--move-reflection-ink)]"
      }`}
    >
      {tone === "shuts" ? (
        <span
          aria-hidden
          className="mt-1 block size-0 shrink-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[color:var(--move-inconsistent)]"
        />
      ) : (
        <span aria-hidden className="mt-1.5 block size-2.5 shrink-0 rotate-45 bg-[color:var(--move-reflection)]" />
      )}
      <span>{children}</span>
    </p>
  );
}

/** A persona's opening line, for the closing band. */
export function FirstLine({ name, role, line }: { name: string; role: string; line: string }) {
  return (
    <figure className="mx-auto max-w-sm">
      <blockquote className="rounded-[1.5rem] rounded-bl-md border-2 border-line bg-soft px-5 py-4 font-display text-xl font-semibold leading-snug text-ink">
        “{line}”
      </blockquote>
      <figcaption className="mt-3 pl-1 font-semibold text-muted">
        <span className="font-display font-bold text-ink">{name}</span>, {role.toLowerCase()}
      </figcaption>
    </figure>
  );
}
