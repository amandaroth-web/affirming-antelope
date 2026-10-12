import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

type FaqProps = {
  items: { q: string; a: string }[];
  heading?: string;
  id?: string;
  /** Heading level of the section title; questions sit one level below. */
  level?: 2 | 3;
  /** Shown under the heading; on wide screens the heading column sits beside the list. */
  aside?: ReactNode;
};

/** FAQ accordion. Pair it with `faqPageLd` for FAQPage structured data. */
export function Faq({ items, heading = "Questions people ask", id = "faq", level = 2, aside }: FaqProps) {
  const H = level === 2 ? "h2" : "h3";
  const Q = level === 2 ? "h3" : "h4";
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={`scroll-mt-20 ${aside ? "grid gap-8 lg:grid-cols-12 lg:gap-12" : ""}`}
      id={id}
    >
      <div className={aside ? "lg:sticky lg:top-24 lg:col-span-4 lg:self-start" : undefined}>
      <H
        id={`${id}-heading`}
        className="pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
      >
        {heading}
      </H>
      {aside}
      </div>
      <div className={aside ? "space-y-3 lg:col-span-8" : "mt-8 space-y-3"}>
        {items.map((item, i) => (
          <details
            key={item.q}
            open={i === 0}
            className="group rounded-[1.25rem] border-2 border-line bg-white shadow-[0_4px_0_var(--shadow)] open:border-primary-tint"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.1rem] px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
              <Q className="font-display text-lg font-bold text-ink">{item.q}</Q>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-soft text-primary-shadow transition-transform duration-200 group-open:rotate-180">
                <CaretDown size={16} weight="bold" aria-hidden />
              </span>
            </summary>
            <p className="max-w-[62ch] px-5 pb-5 font-semibold leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
