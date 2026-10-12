import Link from "next/link";
import { ctaTrack, PRICING_LINE, TRAINER_PATH } from "@/lib/site";
import { PilotCta } from "../get-the-app";
import { Reveal } from "../reveal";
import { DashboardMock } from "./dashboard-mock";

const gets = [
  "Share a join code and assign drills and role-plays with due dates.",
  "Read the role-plays learners send you and reply in writing or with a voice note.",
];

export function TrainerPilot() {
  return (
    <section id="pilot" aria-labelledby="pilot-heading" className="scroll-mt-16 bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:items-center lg:gap-14">
        <Reveal className="lg:order-2 lg:col-span-5">
          <h2
            id="pilot-heading"
            className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-[2.6rem]"
          >
            Coaching a group of managers?
          </h2>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-[color:var(--on-primary-muted)]">
            Your leaders practice between sessions. The dashboard shows who has
            done the assigned work and when each person was last active.
          </p>

          <ul className="mt-6 list-disc space-y-2 pl-5 text-lg font-semibold leading-snug text-white marker:text-primary-tint">
            {gets.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <PilotCta location="trainer_pilot" size="lg" />
            <Link
              href={TRAINER_PATH}
              prefetch={false}
              {...ctaTrack("trainer_pilot", "trainer", "trainers")}
              className="font-extrabold text-white underline decoration-primary-tint decoration-2 underline-offset-4 hover:text-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Open the dashboard
            </Link>
          </div>
          <p className="mt-5 text-sm font-bold text-[color:var(--on-primary-muted)]">{PRICING_LINE}</p>
        </Reveal>

        <div className="lg:order-1 lg:col-span-7 lg:pb-12">
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}
