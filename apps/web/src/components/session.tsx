import { Door, Fire, Target } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "./reveal";

const beats = [
  {
    title: "One short drill",
    body: "One OARS move. A few minutes. Out loud, not in your head.",
    icon: Target,
  },
  {
    title: "See the habit",
    body: "Closed questions. Advice too early. Skipping the affirmation.",
    icon: Fire,
  },
  {
    title: "Back to the room",
    body: "Close the app. Sit down with a real person. That is the test.",
    icon: Door,
  },
];

export function Session() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 bg-primary text-primary-ink"
      aria-labelledby="session-heading"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-start md:px-8 md:py-24">
        <Reveal>
          <h2
            id="session-heading"
            className="max-w-[16ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-4xl"
          >
            Practice, notice, use it.
          </h2>
          <p className="mt-3 max-w-[42ch] text-lg font-semibold text-primary-ink/90">
            Short enough to do before work. Focused enough to change what
            happens in the room.
          </p>
        </Reveal>

        <ul className="space-y-4">
          {beats.map((beat, i) => {
            const Icon = beat.icon;
            return (
              <Reveal key={beat.title} delay={0.05 * i}>
                <li className="flex items-start gap-4 rounded-[1.25rem] border-2 border-line bg-white p-5 text-ink shadow-[0_5px_0_var(--primary-shadow)]">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gold text-ink shadow-[0_3px_0_var(--gold-shadow)]">
                    <Icon size={26} weight="bold" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold">{beat.title}</h3>
                    <p className="mt-0.5 font-semibold leading-snug text-muted">
                      {beat.body}
                    </p>
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
