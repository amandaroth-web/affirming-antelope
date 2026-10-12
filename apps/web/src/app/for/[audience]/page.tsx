import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDrill, getScenario, MI_FOR_LEADERS } from "@antelope/core";
import { CliniciansSections } from "@/components/audience/clinicians";
import { LeadersSections } from "@/components/audience/leaders";
import { FirstLine } from "@/components/audience/parts";
import { SampleFeedback, TrainersSections } from "@/components/audience/trainers";
import { DownloadBand } from "@/components/download-band";
import { CtaNote, GetTheApp, PilotCta, TrainerCta } from "@/components/get-the-app";
import { Faq } from "@/components/marketing/faq";
import { CohortShowcase, DrillShowcase, PathwayShowcase } from "@/components/marketing/showcase";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { AUDIENCE_SLUGS, getAudience, type AudiencePage } from "@/lib/audiences";
import { getAllGuides } from "@/lib/guides";
import { faqPageLd, JsonLd, softwareApplicationLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { PRICING_LINE, SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return AUDIENCE_SLUGS.map((audience) => ({ audience }));
}

export async function generateMetadata({ params }: PageProps<"/for/[audience]">): Promise<Metadata> {
  const { audience } = await params;
  const page = getAudience(audience);
  if (!page) return {};
  return pageMetadata({
    title: page.metaTitle,
    description: page.metaDescription,
    path: `/for/${page.slug}`,
    keywords: page.keywords,
  });
}

/** The hero drill per audience: a clinician-patient drill for clinicians, a manager-employee one for leaders. */
const SHOWCASE_DRILL: Partial<Record<AudiencePage["slug"], string>> = {
  clinicians: "drill-cl-oars-02",
};

function Showcase({ page }: { page: AudiencePage }) {
  if (page.showcase === "drill") {
    const drill = getDrill(SHOWCASE_DRILL[page.slug] ?? "drill-oars-02");
    return drill ? <DrillShowcase drill={drill} /> : null;
  }
  if (page.showcase === "pathway") {
    return (
      <PathwayShowcase
        title={MI_FOR_LEADERS.title}
        units={MI_FOR_LEADERS.units.slice(0, 5)}
        total={MI_FOR_LEADERS.units.length}
      />
    );
  }
  return <CohortShowcase />;
}

/** Keeps hyphenated words like "one-on-one" on one line. */
function NoBreakHyphens({ text }: { text: string }) {
  return text.split(" ").map((word, i) => (
    <span key={i}>
      {i > 0 && " "}
      {word.includes("-") ? <span className="whitespace-nowrap">{word}</span> : word}
    </span>
  ));
}

/** The closing band's visual: the waving antelope for leaders, a line from the page otherwise. */
function ClosingAside({ slug }: { slug: AudiencePage["slug"] }) {
  if (slug === "trainers") return <SampleFeedback />;
  if (slug === "clinicians") {
    const len = getScenario("CL-102");
    return len ? <FirstLine name={len.persona.name} role={len.persona.role} line={len.openingLine} /> : null;
  }
  return null;
}

export default async function AudienceRoute({ params }: PageProps<"/for/[audience]">) {
  const { audience } = await params;
  const page = getAudience(audience);
  if (!page) notFound();

  const location = `audience_${page.slug}`;
  const isTrainer = page.slug === "trainers";
  const url = `${SITE_URL}/for/${page.slug}`;
  const allGuides = getAllGuides();
  const guides = page.guides
    .map((slug) => allGuides.find((g) => g.slug === slug))
    .filter((g) => g !== undefined);

  return (
    <>
      <JsonLd
        data={[
          softwareApplicationLd({ description: page.metaDescription, audience: page.audienceType }),
          faqPageLd(page.faq, url),
        ]}
      />
      <SiteNav />
      <main>
        {/* Hero */}
        <section>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-12 md:grid-cols-12 md:gap-8 md:px-8 md:py-16">
            <div className="min-w-0 md:col-span-6">
              <p className="mb-4 inline-flex rounded-xl bg-soft px-3 py-1.5 text-sm font-extrabold text-primary-shadow">
                {page.eyebrow}
              </p>
              <h1 className="max-w-[16ch] pb-1 font-display text-4xl font-bold leading-[1.04] tracking-tight text-ink md:text-5xl lg:text-[3.3rem]">
                <NoBreakHyphens text={page.h1} />
              </h1>
              <p className="mt-5 max-w-[40ch] text-lg font-semibold leading-snug text-muted">{page.lede}</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
                {isTrainer ? (
                  <>
                    <PilotCta location="trainers_hero" size="lg" />
                    <TrainerCta location={location} size="lg" />
                  </>
                ) : (
                  <GetTheApp location={location} audience={page.slug} size="lg" />
                )}
              </div>
              {isTrainer ? (
                <p className="mt-4 max-w-[44ch] text-sm font-bold text-muted">{PRICING_LINE}</p>
              ) : (
                <CtaNote className="mt-4" />
              )}
            </div>
            <div className="relative min-w-0 md:col-span-6">
              <Showcase page={page} />
            </div>
          </div>
        </section>

        {page.slug === "leaders" && <LeadersSections />}
        {page.slug === "trainers" && <TrainersSections />}
        {page.slug === "clinicians" && <CliniciansSections />}

        {/* FAQ + related guides */}
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-12 md:px-8 md:py-24">
          <div className="md:col-span-8">
            <Faq items={page.faq} heading={page.faqHeading} />
          </div>
          <aside className="md:col-span-4" aria-labelledby="aside-guides-heading">
            <h2 id="aside-guides-heading" className="font-display text-xl font-bold text-ink">
              {page.guidesHeading}
            </h2>
            <ul className="mt-4 space-y-3">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/guides/${g.slug}`}
                    className="block rounded-[1.25rem] border-2 border-line bg-white p-4 font-bold text-ink shadow-[0_4px_0_var(--shadow)] hover:border-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {g.title}
                    <span className="mt-1 block text-sm font-semibold text-muted">{g.readingMinutes} min read</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/guides"
                  className="font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
                >
                  All MI guides
                </Link>
              </li>
              {AUDIENCE_SLUGS.filter((s) => s !== page.slug).map((s) => (
                <li key={s}>
                  <Link
                    href={`/for/${s}`}
                    className="font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
                  >
                    {getAudience(s)?.linkLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <DownloadBand
          location={location}
          audience={page.slug}
          heading={page.closingHeading}
          body={page.closingBody}
          trainer={isTrainer}
          pilotLocation="trainers_closing"
          mascot={page.slug === "leaders"}
          mascotLine={null}
          aside={page.slug === "leaders" ? undefined : <ClosingAside slug={page.slug} />}
        />
      </main>
      <SiteFooter />
    </>
  );
}
