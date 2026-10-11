import { ArrowRight, ChalkboardTeacher, Stethoscope, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Reveal } from "./reveal";

const people = [
  {
    href: "/for/clinicians",
    who: "Clinicians",
    line: "Physicians, nurses, therapists, and coaches. Keep the MI you trained in from fading between workshops.",
    icon: Stethoscope,
  },
  {
    href: "/for/leaders",
    who: "Healthcare leaders",
    line: "Managers and supervisors. Rehearse the performance conversation before you have it for real.",
    icon: UsersThree,
  },
  {
    href: "/for/trainers",
    who: "MI trainers",
    line: "Run a cohort, assign practice, and review the role-plays learners choose to send you.",
    icon: ChalkboardTeacher,
  },
];

export function Audience() {
  return (
    <section aria-labelledby="audience-heading">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
            Who it&apos;s for
          </p>
          <h2
            id="audience-heading"
            className="mt-2 max-w-[18ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
          >
            If you already sit with people, start here.
          </h2>
          <p className="mt-3 max-w-[42ch] text-lg font-semibold text-muted">
            Amanda built this for the folks she trains. You already know the
            spirit. This gets the skill in the room.
          </p>
        </Reveal>

        <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {people.map((person, i) => {
            const Icon = person.icon;
            return (
              <li key={person.href}>
                <Reveal delay={0.05 * i} className="h-full">
                  <Link
                    href={person.href}
                    className="group flex h-full flex-col rounded-[1.25rem] border-2 border-line bg-surface p-5 shadow-[0_5px_0_var(--shadow)] transition-[transform,box-shadow,border-color] duration-100 ease-out hover:-translate-y-0.5 hover:border-primary-tint hover:shadow-[0_7px_0_var(--shadow)] active:translate-y-1 active:shadow-[0_1px_0_var(--shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-soft text-primary-shadow">
                      <Icon size={26} weight="bold" aria-hidden />
                    </span>
                    <span className="mt-4 font-display text-xl font-bold text-ink">{person.who}</span>
                    <span className="mt-1 flex-1 font-semibold leading-snug text-muted">{person.line}</span>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-extrabold text-primary-shadow">
                      See how it fits
                      <ArrowRight
                        size={16}
                        weight="bold"
                        aria-hidden
                        className="transition-transform duration-150 group-hover:translate-x-1"
                      />
                    </span>
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
