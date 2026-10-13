import type { Difficulty } from "@antelope/core";
import { difficultyLabel, initials } from "@/lib/scenarios";

const level: Record<Difficulty, number> = { intro: 1, intermediate: 2, advanced: 3 };

/** Difficulty as a label with filled pips, so the level reads at a glance. */
export function DifficultyPips({ value, className = "" }: { value: Difficulty; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-extrabold text-ink ${className}`}>
      <span aria-hidden className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`size-2.5 rounded-full ${n <= level[value] ? "bg-gold" : "bg-soft-deep"}`} />
        ))}
      </span>
      {difficultyLabel[value]}
    </span>
  );
}

/** Initials in a gold disc, standing in for the persona's avatar. */
export function PersonaDisc({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "size-14 text-xl" : "size-10 text-base";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-gold font-display font-bold text-ink shadow-[0_3px_0_var(--gold-shadow)] ${dims}`}
    >
      {initials(name)}
    </span>
  );
}
