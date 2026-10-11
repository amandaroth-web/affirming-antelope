"use client";

import {
  ChatTeardropDots,
  ListBullets,
  Quotes,
  SealCheck,
} from "@phosphor-icons/react";
import { Reveal } from "./reveal";

const skills = [
  {
    name: "Open questions",
    body: "Ask so they tell a story, not yes or no.",
    icon: ChatTeardropDots,
  },
  {
    name: "Affirmations",
    body: "Name the strength you heard. Not cheerleading.",
    icon: SealCheck,
    active: true,
  },
  {
    name: "Reflections",
    body: "Say back the meaning, feeling included.",
    icon: Quotes,
  },
  {
    name: "Summaries",
    body: "Gather what matters so they can hear it.",
    icon: ListBullets,
  },
];

export function Oars() {
  return (
    <section className="border-y-2 border-line bg-soft" aria-labelledby="oars-heading">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <h2
            id="oars-heading"
            className="max-w-[14ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
          >
            Your OARS path.
          </h2>
          <p className="mt-3 max-w-[40ch] text-lg font-semibold text-ink/80">
            Four skills. One conversation. Drill them like vocab.
          </p>
        </Reveal>

        <ol className="mt-10 grid gap-5 md:grid-cols-2">
          {skills.map((skill, i) => {
            const Icon = skill.icon;
            const active = Boolean(skill.active);
            return (
              <li key={skill.name}>
                <Reveal
                  delay={0.05 * i}
                  className="flex h-full items-center gap-4 rounded-[1.25rem] border-2 border-line bg-white p-5 shadow-[0_5px_0_var(--shadow)]"
                >
                  <div
                    className={`flex size-16 shrink-0 items-center justify-center rounded-2xl ${
                      active
                        ? "bg-gold text-ink shadow-[0_4px_0_var(--gold-shadow)]"
                        : "bg-primary text-primary-ink shadow-[0_4px_0_var(--primary-shadow)]"
                    }`}
                  >
                    <Icon size={30} weight="bold" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-ink">{skill.name}</h3>
                    <p className="mt-1 max-w-[28ch] font-semibold leading-snug text-muted">
                      {skill.body}
                    </p>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
