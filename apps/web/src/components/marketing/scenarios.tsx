import { SCENARIOS, scenariosForSetting, type Setting } from "@antelope/core";
import Link from "next/link";
import { Reveal } from "@/components/reveal";

const difficultyLabel = { intro: "Intro", intermediate: "Intermediate", advanced: "Advanced" } as const;
const settingLabel = { workplace: "MI for Leaders", clinical: "MI for Clinicians" } as const;

type ScenariosProps = {
  heading: string;
  body: string;
  setting?: Setting;
  /** `cards` leads with each persona's first line; `list` is the compact library a trainer assigns from. */
  variant?: "cards" | "list";
  /** Scenario ids already featured elsewhere on the page. */
  exclude?: string[];
};

/** The role-play library from @antelope/core: who learners talk to. */
export function Scenarios({ heading, body, setting, variant = "cards", exclude = [] }: ScenariosProps) {
  const scenarios = (setting ? scenariosForSetting(setting) : SCENARIOS).filter((s) => !exclude.includes(s.id));
  return (
    <section aria-labelledby="scenarios-heading">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <h2
            id="scenarios-heading"
            className="max-w-[22ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
          >
            {heading}
          </h2>
          <p className="mt-3 max-w-[48ch] text-lg font-semibold text-ink/80">{body}</p>
          <p className="mt-3">
            <Link
              href="/scenarios"
              className="font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Browse every role-play scenario
            </Link>
          </p>
        </Reveal>

        {variant === "list" ? (
          <Reveal className="mt-10 overflow-hidden rounded-[1.25rem] border-2 border-line bg-white">
            <ul className="divide-y-2 divide-soft">
              {scenarios.map((s) => (
                <li
                  key={s.id}
                  className="grid gap-1 px-5 py-4 md:grid-cols-[14rem_1fr_11rem_8rem] md:items-baseline md:gap-6"
                >
                  <div>
                    <p className="font-display font-bold text-ink">{s.persona.name}</p>
                    <p className="text-sm font-semibold leading-snug text-muted">{s.persona.role}</p>
                  </div>
                  <p className="font-bold text-ink">
                    {s.title}
                    <span className="block text-sm font-semibold text-muted">{s.issue}</span>
                  </p>
                  <div className="mt-1 flex gap-3 md:contents">
                    <p className="text-sm font-extrabold text-primary-shadow">{settingLabel[s.setting]}</p>
                    <p className="text-sm font-bold text-muted">{difficultyLabel[s.difficulty]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        ) : (
          <ul className={`mt-10 grid gap-4 md:grid-cols-2 ${scenarios.length % 3 === 0 ? "lg:grid-cols-3" : ""}`}>
            {scenarios.map((s, i) => (
              <li key={s.id}>
                <Reveal
                  delay={0.04 * i}
                  className="flex h-full flex-col rounded-[1.25rem] border-2 border-line bg-white p-5 shadow-[0_5px_0_var(--shadow)]"
                >
                  <p className="rounded-2xl rounded-tl-md border-2 border-line bg-soft px-4 py-3 text-lg font-bold leading-snug text-ink">
                    “{s.openingLine}”
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-gold font-display font-bold text-ink shadow-[0_3px_0_var(--gold-shadow)]"
                    >
                      {s.persona.name[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display font-bold text-ink">{s.persona.name}</p>
                      <p className="text-sm font-semibold leading-snug text-muted">{s.persona.role}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-bold text-muted">
                    {s.title} · {difficultyLabel[s.difficulty]}
                  </p>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
