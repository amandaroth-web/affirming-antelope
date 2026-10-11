"use client";

import { useEffect, useState } from "react";

type Heading = { depth: 2 | 3; text: string; id: string };

/** Table of contents with the section you're reading highlighted. */
export function Toc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string | undefined>(headings[0]?.id);

  useEffect(() => {
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  return (
    <nav aria-labelledby="toc-heading">
      <p id="toc-heading" className="text-xs font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
        On this page
      </p>
      <ol className="mt-3 space-y-0.5 border-l-2 border-line">
        {headings.map((h) => {
          const on = h.id === active;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                aria-current={on ? "location" : undefined}
                className={`-ml-0.5 block border-l-2 py-1.5 text-[0.92rem] leading-snug transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  h.depth === 3 ? "pl-7" : "pl-4"
                } ${
                  on
                    ? "border-primary font-extrabold text-ink"
                    : "border-transparent font-bold text-muted hover:text-ink"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
