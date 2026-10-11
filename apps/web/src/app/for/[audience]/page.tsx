import {
  Browser,
  ChartBar,
  ChatsCircle,
  ClipboardText,
  Clock,
  LockSimple,
  Microphone,
  Path,
  Target,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDrill, MI_FOR_LEADERS } from "@antelope/core";
import { DownloadBand } from "@/components/download-band";
import { CtaNote, GetTheApp, TrainerCta } from "@/components/get-the-app";
import { Faq } from "@/components/marketing/faq";
import { Scenarios } from "@/components/marketing/scenarios";
import { CohortShowcase, DrillShowcase, PathwayShowcase } from "@/components/marketing/showcase";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { AUDIENCE_SLUGS, getAudience, type AudienceIcon, type AudiencePage } from "@/lib/audiences";
import { getAllGuides } from "@/lib/guides";
import { faqPageLd, JsonLd, softwareApplicationLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/site";

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

const icons: Record<AudienceIcon, typeof Target> = {
  target: Target,
  chat: ChatsCircle,
  chart: ChartBar,
  path: Path,
  review: Microphone,
  users: UsersThree,
  clock: Clock,
  lock: LockSimple,
  assign: ClipboardText,
  browser: Browser,
};

const bubble: Record<AudiencePage["slug"], string> = {
  clinicians: "Five minutes. Go.",
  leaders: "Week three already.",
  trainers: "Two to review!",
};

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

export default async function AudienceRoute({ params }: PageProps<"/for/[audience]">) {
  const { audience } = await params;
  const page = getAudience(audience);
  if (!page) notFound();

  const location = `audience_${page.slug}`;
  const isTrainer = page.slug === "trainers";
  const url = `${SITE_URL}/for/${page.slug}`;
  const guides = getAllGuides()
    .filter((g) => g.audience === page.slug || g.audience === "all")
    .slice(0, 3);

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
                {page.h1}
              </h1>
              <p className="mt-5 max-w-[40ch] text-lg font-semibold leading-snug text-muted">{page.lede}</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
                {isTrainer ? (
                  <>
                    <TrainerCta location={location} size="lg" variant="primary" />
                    <GetTheApp location={location} audience={page.slug} size="lg" variant="secondary">
                      Try the learner app
                    </GetTheApp>
                  </>
                ) : (
                  <GetTheApp location={location} audience={page.slug} size="lg" />
                )}
              </div>
              {isTrainer ? (
                <p className="mt-4 text-sm font-bold text-muted">No charge today · Learners use any browser</p>
              ) : (
                <CtaNote className="mt-4" />
              )}
            </div>
            <div className="relative min-w-0 md:col-span-6">
              <Showcase page={page} />
              <div className="pointer-events-none relative z-10 mx-auto -mt-6 flex max-w-[26rem] items-end justify-end gap-1 pr-2">
                <p className="mb-14 rounded-2xl rounded-br-md border-2 border-line bg-white px-3 py-2 text-sm font-extrabold text-ink shadow-[0_3px_0_var(--shadow)]">
                  {bubble[page.slug]}
                </p>
                <Image
                  src="/brand-mascot-celebrate-cartoon.png"
                  alt=""
                  width={703}
                  height={914}
                  sizes="100px"
                  className="h-28 w-auto md:h-32"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Pain points */}
        <section className="border-y-2 border-line bg-soft" aria-labelledby="pains-heading">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
            <Reveal>
              <h2
                id="pains-heading"
                className="max-w-[20ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
              >
                {page.painsHeading}
              </h2>
            </Reveal>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {page.pains.map((pain, i) => (
                <li key={pain.title}>
                  <Reveal
                    delay={0.05 * i}
                    className="h-full rounded-[1.25rem] border-2 border-line bg-white p-5 shadow-[0_5px_0_var(--shadow)]"
                  >
                    <h3 className="font-display text-xl font-bold text-ink">{pain.title}</h3>
                    <p className="mt-2 font-semibold leading-snug text-muted">{pain.body}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 bg-primary text-primary-ink" aria-labelledby="steps-heading">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-start md:px-8 md:py-24">
            <Reveal>
              <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-white">How it works</p>
              <h2
                id="steps-heading"
                className="mt-2 max-w-[16ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-4xl"
              >
                {page.stepsHeading}
              </h2>
            </Reveal>
            <ol className="space-y-4">
              {page.steps.map((step, i) => (
                <li key={step.title}>
                  <Reveal
                    delay={0.05 * i}
                    className="flex items-start gap-4 rounded-[1.25rem] border-2 border-line bg-white p-5 text-ink shadow-[0_5px_0_var(--primary-shadow)]"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gold font-display text-xl font-bold text-ink shadow-[0_3px_0_var(--gold-shadow)]">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold">{step.title}</h3>
                      <p className="mt-0.5 font-semibold leading-snug text-muted">{step.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
            <Reveal>
              <h2
                id="features-heading"
                className="max-w-[20ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
              >
                {page.featuresHeading}
              </h2>
            </Reveal>
            <ul className="mt-10 grid gap-5 md:grid-cols-2">
              {page.features.map((f, i) => {
                const Icon = icons[f.icon];
                return (
                  <li key={f.title}>
                    <Reveal
                      delay={0.05 * i}
                      className="flex h-full items-start gap-4 rounded-[1.25rem] border-2 border-line bg-white p-5 shadow-[0_5px_0_var(--shadow)]"
                    >
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-ink shadow-[0_4px_0_var(--primary-shadow)]">
                        <Icon size={28} weight="bold" aria-hidden />
                      </span>
                      <div>
                        <h3 className="font-display text-xl font-bold text-ink">{f.title}</h3>
                        <p className="mt-1 font-semibold leading-snug text-muted">{f.body}</p>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {page.pathway && page.pathwaySection && (
          <section className="border-t-2 border-line bg-soft" aria-labelledby="pathway-heading">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24">
              <Reveal className="min-w-0">
                <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-primary-shadow">
                  {page.pathway.title}
                </p>
                <h2
                  id="pathway-heading"
                  className="mt-2 max-w-[18ch] pb-1 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink md:text-4xl"
                >
                  {page.pathwaySection.heading}
                </h2>
                <p className="mt-3 max-w-[44ch] text-lg font-semibold text-ink/80">{page.pathwaySection.body}</p>
              </Reveal>
              <div className="min-w-0">
                <PathwayShowcase
                  title={page.pathway.title}
                  units={page.pathway.units.slice(0, 5)}
                  total={page.pathway.units.length}
                />
              </div>
            </div>
          </section>
        )}

        <div className={`border-t-2 border-line ${page.pathway ? "" : "bg-soft"}`}>
          <Scenarios
            setting={page.setting}
            heading={isTrainer ? "The role-plays you can assign" : "Who you'll talk to"}
            body={
              isTrainer
                ? "Each scenario has a brief, a goal, and a difficulty. Their backstory stays hidden, so learners have to draw it out."
                : page.setting === "clinical"
                  ? "Every patient here is fictional, with a history you don't see. Their first line is below. The rest depends on you."
                  : "Every person here is fictional, with a history you don't see. Their first line is below. The rest depends on you."
            }
          />
        </div>

        {/* FAQ + related guides */}
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-12 md:px-8 md:py-24">
          <div className="md:col-span-8">
            <Faq items={page.faq} />
          </div>
          <aside className="md:col-span-4" aria-labelledby="aside-guides-heading">
            <h2 id="aside-guides-heading" className="font-display text-xl font-bold text-ink">
              Read next
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
                    {getAudience(s)?.name}: how it fits
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
        />
      </main>
      <SiteFooter />
    </>
  );
}
