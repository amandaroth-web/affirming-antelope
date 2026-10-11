/**
 * Site-wide constants for the marketing site: URLs, names, and CTA link builders.
 * The CTA `data-track` contract lives in docs/tracking-plan.md.
 */

export const SITE_URL = "https://affirmingantelope.com";
export const APP_URL = "https://app.affirmingantelope.com";
export const SITE_NAME = "Affirming Antelope";
export const SITE_TAGLINE = "Motivational Interviewing practice";
export const SITE_DESCRIPTION =
  "Free Motivational Interviewing practice: five-minute OARS drills, live AI role-plays with realistic employees, and opt-in trainer review. Works in your browser.";

export type Audience = "clinicians" | "leaders" | "trainers";
export type CtaTarget = "app" | "trainer";

/** Learner app link that carries the CTA location as `?src=`. */
export function appHref(location: string, path = "/") {
  const url = new URL(path, APP_URL);
  url.searchParams.set("src", location);
  return url.toString();
}

/** Deep link into one drill, from a guide. */
export function drillHref(drillId: string, slug: string) {
  return appHref(`guide_${slug}`, `/drill/${encodeURIComponent(drillId)}`);
}

export const TRAINER_PATH = "/trainer";

/** `data-track` attributes for a primary CTA (see docs/tracking-plan.md). */
export function ctaTrack(location: string, target: CtaTarget, audience?: Audience) {
  return {
    "data-track": "cta_clicked",
    "data-track-location": location,
    "data-track-target": target,
    ...(audience ? { "data-track-audience": audience } : {}),
  } as const;
}
