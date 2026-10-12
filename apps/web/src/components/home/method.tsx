import Image from "next/image";
import { Reveal } from "../reveal";

/**
 * The person behind the method. Only facts Amanda has given us: name, credential, role,
 * and the program the app is designed from. No employer, memberships or years.
 */
export const METHOD_LEAD = {
  name: "Amanda Roth, LCSW",
  role: "Principal, Psychotherapy Clinical Quality",
  photo: { src: "/team/amanda-roth.jpg", width: 500, height: 500 },
  alt: "Portrait of Amanda Roth, LCSW",
  // TODO: Amanda to write or approve. The quote renders only when this is non-empty.
  quote: "",
};

// From the PM-017 spec in packages/core/src/scenarios.ts (sustain and change triggers).
const spec = {
  shuts: [
    "Lecturing about the impact on the finance team",
    "Offering solutions before understanding",
    "Defending the promotion decision",
  ],
  opens: [
    "Reflecting the frustration under his flat answers",
    "Affirming his track record specifically",
    "Emphasizing that how he handles this is his choice",
  ],
};

export function Method() {
  const { quote } = METHOD_LEAD;

  return (
    <section aria-labelledby="method-heading" className="border-y-2 border-line bg-soft">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:items-center">
        <Reveal className="lg:col-span-6">
          <h2
            id="method-heading"
            className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-[2.6rem]"
          >
            The method behind it.
          </h2>
          <p className="mt-4 max-w-[46ch] text-lg font-semibold leading-relaxed text-ink/80">
            Designed from the MI for Leaders program Amanda Roth teaches. Every
            employee is written from a scenario spec: who they are, what shuts
            them down, and what helps them open up.
          </p>

          {quote ? (
            <blockquote className="mt-8 max-w-[46ch] border-l-4 border-primary pl-5 font-display text-xl font-semibold leading-snug text-ink">
              &ldquo;{quote}&rdquo;
            </blockquote>
          ) : null}

          <div className="mt-8 flex items-center gap-5">
            <Image
              src={METHOD_LEAD.photo.src}
              alt={METHOD_LEAD.alt}
              width={METHOD_LEAD.photo.width}
              height={METHOD_LEAD.photo.height}
              sizes="96px"
              className="size-24 shrink-0 rounded-full border-4 border-white object-cover shadow-[0_4px_0_var(--shadow)]"
            />
            <div>
              <p className="font-display text-xl font-bold text-ink">{METHOD_LEAD.name}</p>
              <p className="mt-0.5 font-semibold leading-snug text-muted">{METHOD_LEAD.role}</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-6">
          <figure className="rounded-[1.5rem] border-2 border-dashed border-primary-tint bg-white p-6 md:p-7">
            <figcaption>
              <span className="text-xs font-extrabold text-primary-shadow">From the scenario spec</span>
              <span className="mt-1 block font-display text-xl font-bold text-ink">
                Darnell Brooks, revenue cycle analyst
              </span>
              <span className="mt-1 block font-semibold leading-snug text-muted">
                Four years in. His month-end reports have been late three months running.
              </span>
            </figcaption>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 font-display font-bold text-[color:var(--move-inconsistent-ink)]">
                  <span aria-hidden className="block size-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-[color:var(--move-inconsistent)]" />
                  Shuts him down
                </p>
                <ul className="mt-3 space-y-2.5">
                  {spec.shuts.map((s) => (
                    <li key={s} className="font-semibold leading-snug text-ink">{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="flex items-center gap-2 font-display font-bold text-[color:var(--move-reflection-ink)]">
                  <span aria-hidden className="block size-2.5 rotate-45 bg-[color:var(--move-reflection)]" />
                  Opens him up
                </p>
                <ul className="mt-3 space-y-2.5">
                  {spec.opens.map((s) => (
                    <li key={s} className="font-semibold leading-snug text-ink">{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
