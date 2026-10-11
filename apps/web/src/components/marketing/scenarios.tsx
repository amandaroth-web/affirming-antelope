import { SCENARIOS } from "@antelope/core";
import { Reveal } from "@/components/reveal";

const difficultyLabel = { intro: "Intro", intermediate: "Intermediate", advanced: "Advanced" } as const;

/** The role-play library from @antelope/core: who learners actually talk to. */
export function Scenarios({ heading, body }: { heading: string; body: string }) {
  return (
    <section aria-labelledby="scenarios-heading">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <h2
            id="scenarios-heading"
            className="max-w-[20ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
          >
            {heading}
          </h2>
          <p className="mt-3 max-w-[48ch] text-lg font-semibold text-ink/80">{body}</p>
        </Reveal>
        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s, i) => (
            <li key={s.id}>
              <Reveal
                delay={0.04 * i}
                className="flex h-full flex-col rounded-[1.25rem] border-2 border-line bg-white p-5 shadow-[0_5px_0_var(--shadow)]"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-gold font-display text-lg font-bold text-ink shadow-[0_3px_0_var(--gold-shadow)]"
                  >
                    {s.persona.name[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">{s.persona.name}</p>
                    <p className="text-sm font-semibold leading-snug text-muted">{s.persona.role}</p>
                  </div>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm font-bold text-muted">
                  {s.issue} · {difficultyLabel[s.difficulty]}
                </p>
                <p className="mt-4 rounded-2xl rounded-tl-md border-2 border-line bg-soft px-4 py-3 font-bold leading-snug text-ink">
                  “{s.openingLine}”
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
