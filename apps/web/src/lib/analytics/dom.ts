"use client";

import { ANALYTICS_BRIDGE_PARAMS, APP_ORIGIN, type AudienceId, type CtaLocation } from "@antelope/core";
import { bridgeIds, track } from "./client";

/**
 * One delegated click listener for the whole site:
 *  1. `[data-track]` elements become typed events (`cta_clicked`, `guide_drill_clicked`)
 *     built only from their `data-track-*` attributes. Link text is never read.
 *  2. Any link to the learner app gets `ph_did`, `ph_sid` (and `src`, if it has a
 *     `data-track-location`) appended, so the app can bootstrap the same identity.
 */

const AUDIENCES: AudienceId[] = ["clinicians", "leaders", "trainers"];
const LOCATION = /^(hero|nav|download_band|footer|audience_[a-z0-9_-]+|guide_[a-z0-9_-]+)$/i;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function appLink(el: Element | null): HTMLAnchorElement | null {
  const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a) return null;
  try {
    return new URL(a.href, window.location.href).origin === APP_ORIGIN ? a : null;
  } catch {
    return null;
  }
}

/** Appends the bridge params to a link to the app. A no-op until PostHog is running. */
function decorate(a: HTMLAnchorElement, location: string | undefined) {
  const ids = bridgeIds();
  if (!ids) return;
  const url = new URL(a.href, window.location.href);
  url.searchParams.set(ANALYTICS_BRIDGE_PARAMS.distinctId, ids.distinctId);
  url.searchParams.set(ANALYTICS_BRIDGE_PARAMS.sessionId, ids.sessionId);
  if (location && !url.searchParams.has(ANALYTICS_BRIDGE_PARAMS.src)) {
    url.searchParams.set(ANALYTICS_BRIDGE_PARAMS.src, location);
  }
  a.href = url.toString();
}

function onClick(e: Event) {
  const target = e.target instanceof Element ? e.target : null;
  const tracked = target?.closest<HTMLElement>("[data-track]") ?? null;
  const ds = tracked?.dataset;

  const link = appLink(tracked) ?? appLink(target);
  if (link) decorate(link, ds?.trackLocation ?? link.dataset.trackLocation);

  // Auxiliary clicks (middle button) only need the link decorated, not a second event.
  if (!tracked || !ds || (e as MouseEvent).button > 0) return;

  switch (ds.track) {
    case "cta_clicked": {
      const location = ds.trackLocation;
      const dest = ds.trackTarget;
      if (!location || !LOCATION.test(location) || (dest !== "app" && dest !== "trainer")) return;
      const audience = AUDIENCES.find((a) => a === ds.trackAudience);
      track("cta_clicked", { location: location as CtaLocation, target: dest, ...(audience ? { audience } : {}) });
      break;
    }
    case "guide_drill_clicked": {
      const slug = ds.trackSlug;
      const drillId = ds.trackDrillId;
      if (!slug || !drillId || !SLUG.test(slug) || !SLUG.test(drillId)) return;
      track("guide_drill_clicked", { slug, drill_id: drillId });
      break;
    }
  }
}

let installed = false;

export function installClickTracking(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  // Capture phase, so the href is final before the browser follows it.
  document.addEventListener("click", onClick, true);
  document.addEventListener("auxclick", onClick, true);
  // "Copy link address" and long-press read the href without a click.
  document.addEventListener("contextmenu", onClick, true);
}
