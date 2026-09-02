"use client";

import { GetTheApp } from "./get-the-app";
import { Reveal } from "./reveal";
import { StreakCard } from "./streak-card";

export function DownloadBand() {
  return (
    <section
      id="download"
      className="scroll-mt-16 border-t-2 border-line bg-soft"
      aria-labelledby="download-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid items-center gap-8 rounded-[2rem] border-2 border-line bg-white px-6 py-8 shadow-[0_6px_0_var(--shadow)] md:grid-cols-12 md:px-10 md:py-10">
          <Reveal className="md:col-span-7">
            <h2
              id="download-heading"
              className="max-w-[12ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
            >
              Start a streak.
            </h2>
            <p className="mt-3 max-w-[36ch] text-lg font-semibold text-muted">
              Practice on your phone, between the sessions that count.
            </p>
            <div className="mt-8">
              <GetTheApp />
            </div>
          </Reveal>
          <div className="md:col-span-5">
            <StreakCard />
          </div>
        </div>
      </div>
    </section>
  );
}
