import Link from "next/link";
import { CtaNote, GetTheApp, TrainerCta } from "./get-the-app";
import { Reveal } from "./reveal";
import { StreakCard } from "./streak-card";

type DownloadBandProps = {
  /** CTA location, e.g. `download_band` on home or `audience_leaders` on an audience page. */
  location?: string;
  audience?: "clinicians" | "leaders" | "trainers";
  heading?: string;
  body?: string;
  /** Lead with the trainer dashboard instead of the learner app. */
  trainer?: boolean;
};

export function DownloadBand({
  location = "download_band",
  audience,
  heading = "Start a streak today.",
  body = "Open it in your browser, on your phone or your laptop. No download, no card. Your first drill takes five minutes.",
  trainer = false,
}: DownloadBandProps) {
  return (
    <section
      id="start"
      className="scroll-mt-16 border-t-2 border-line bg-soft"
      aria-labelledby={`start-heading-${location}`}
    >
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="grid items-center gap-8 rounded-[2rem] border-2 border-line bg-white px-6 py-8 shadow-[0_6px_0_var(--shadow)] md:grid-cols-12 md:px-10 md:py-10">
          <Reveal className="md:col-span-7">
            <h2
              id={`start-heading-${location}`}
              className="max-w-[14ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
            >
              {heading}
            </h2>
            <p className="mt-3 max-w-[40ch] text-lg font-semibold text-muted">{body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
              {trainer ? (
                <>
                  <TrainerCta location={location} size="lg" variant="primary" />
                  <GetTheApp location={location} audience={audience} size="lg" variant="secondary">
                    Try the learner app
                  </GetTheApp>
                </>
              ) : (
                <GetTheApp location={location} audience={audience} size="lg" />
              )}
            </div>
            {!trainer && <CtaNote className="mt-4" />}
            {!trainer && (
              <p className="mt-6 border-t-2 border-soft pt-5 font-semibold text-muted">
                Running a cohort?{" "}
                <Link
                  href="/for/trainers"
                  className="font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  See how trainer review works
                </Link>
              </p>
            )}
          </Reveal>
          <div className="md:col-span-5">
            <StreakCard />
          </div>
        </div>
      </div>
    </section>
  );
}
