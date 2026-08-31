import { Reveal } from "./reveal";

const people = [
  { who: "Counselors", line: "Warm up before the weekly hour." },
  { who: "Coaches", line: "Change talk, not a better pep talk." },
  { who: "Clinicians", line: "MI you learned, back in your mouth." },
  { who: "Supervisors", line: "A drill people will actually open." },
];

export function Audience() {
  return (
    <section aria-labelledby="audience-heading">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <h2
            id="audience-heading"
            className="max-w-[16ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
          >
            If you already sit with people, start here.
          </h2>
          <p className="mt-3 max-w-[42ch] text-lg font-semibold text-muted">
            Amanda built this for the folks she trains. You already know the
            spirit. This gets the skill in the room.
          </p>
        </Reveal>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {people.map((person, i) => (
            <li key={person.who}>
              <Reveal delay={0.04 * i}>
                <div className="rounded-[1.25rem] border-2 border-line bg-surface px-5 py-4 shadow-[0_5px_0_var(--shadow)]">
                  <p className="font-display font-bold text-ink">{person.who}</p>
                  <p className="mt-1 font-semibold text-muted">{person.line}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
