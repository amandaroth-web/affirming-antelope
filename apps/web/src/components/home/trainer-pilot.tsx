import { ChartBar, ChatCircleText, ClipboardText } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ctaTrack, PRICING_LINE, TRAINER_PATH } from "@/lib/site";
import { PilotCta } from "../get-the-app";
import { Reveal } from "../reveal";
import { DashboardMock } from "./dashboard-mock";

const gets = [
  {
    title: "Assign practice",
    body: "Share a join code, then assign drills and role-plays with due dates.",
    icon: ClipboardText,
  },
  {
    title: "See who's practicing",
    body: "Assigned, completed and last active for everyone in the cohort.",
    icon: ChartBar,
  },
  {
    title: "Review shared sessions",
    body: "Learners choose what to send you. Reply in writing or with a voice note.",
    icon: ChatCircleText,
  },
];

export function TrainerPilot() {
  return (
    <section id="pilot" aria-labelledby="pilot-heading" className="scroll-mt-16 bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:items-center lg:gap-14">
        <Reveal className="lg:order-2 lg:col-span-5">
          <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-primary-tint">
            For MI trainers and team leads
          </p>
          <h2
            id="pilot-heading"
            className="mt-3 pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-[2.6rem]"
          >
            Run your next cohort on Affirming Antelope.
          </h2>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-[color:var(--on-primary-muted)]">
            Your leaders get daily reps between sessions. You see the practice,
            not just the attendance.
          </p>

          <ul className="mt-8 space-y-5">
            {gets.map(({ title, body, icon: Icon }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
                  <Icon size={22} weight="bold" aria-hidden />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold">{title}</h3>
                  <p className="font-semibold leading-snug text-[color:var(--on-primary-muted)]">{body}</p>
                </div>
              </li>
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
