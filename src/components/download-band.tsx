"use client";

import { GetTheApp } from "./get-the-app";
import { Mascot } from "./mascot";
import { Reveal } from "./reveal";

export function DownloadBand() {
  return (
    <section
      id="download"
      className="scroll-mt-16 border-t-2 border-line bg-soft"
      aria-labelledby="download-heading"
    >
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid items-end gap-6 overflow-hidden rounded-[2rem] border-2 border-line bg-white px-6 pt-8 shadow-[0_6px_0_var(--shadow)] md:grid-cols-12 md:px-10 md:pt-10">
          <Reveal className="pb-8 md:col-span-7 md:pb-10">
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
          <div className="self-end md:col-span-5">
            <Mascot
              pose="celebrate"
              alt="Affirming Antelope celebrating with both hooves up"
              width={703}
              height={914}
              className="mx-auto h-auto w-[min(100%,18rem)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
