import type { AudienceId, CtaLocation } from "@antelope/core";

/**
 * Data attributes the delegated click listener (dom.ts) turns into events. Spread them on
 * any link or button; server components can use them too.
 *
 *   <a href="https://app.affirmingantelope.com" {...ctaTrack("hero", "app")}>Start free</a>
 *   <a href={drillHref} {...guideDrillTrack("oars-guide", "drill-oars-01")}>Try this drill</a>
 *
 * A link to https://app.affirmingantelope.com also gets ph_did / ph_sid / src appended
 * on click so the app continues the same anonymous identity.
 */
export function ctaTrack(location: CtaLocation, target: "app" | "trainer", audience?: AudienceId) {
  return {
    "data-track": "cta_clicked",
    "data-track-location": location,
    "data-track-target": target,
    ...(audience ? { "data-track-audience": audience } : {}),
  } as const;
}

export function guideDrillTrack(slug: string, drillId: string) {
  return {
    "data-track": "guide_drill_clicked",
    "data-track-slug": slug,
    "data-track-drill-id": drillId,
  } as const;
}
