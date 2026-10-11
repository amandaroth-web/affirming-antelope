"use client";

import {
  scrubProps,
  type AnalyticsPersonProps,
  type AnalyticsSuperProps,
  type AnalyticsSurface,
  type TrackFn,
} from "@antelope/core";

/**
 * PostHog for the website and the trainer dashboard (docs/tracking-plan.md).
 *
 * - No `NEXT_PUBLIC_POSTHOG_KEY`, or Do Not Track / Global Privacy Control set: nothing
 *   is loaded, nothing is queued, and every call below is a no-op.
 * - Marketing pages are cookieless (`persistence: 'memory'`). `/trainer` is a signed-in
 *   tool, so it persists in localStorage + first-party cookie.
 * - Events go through the first-party `/ingest` proxy.
 * - posthog-js is loaded with a dynamic import so it never weighs on the first paint;
 *   calls made before it arrives are queued.
 */

type PostHog = (typeof import("posthog-js"))["default"];

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";
const UI_HOST = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com";

let ph: PostHog | null = null;
let started = false;
let queue: Array<(p: PostHog) => void> = [];
let identifiedAs: string | null = null;
/** True while the page uses cookie + localStorage persistence (trainer pages only). */
let persistent = false;

export function surfaceFor(pathname: string): AnalyticsSurface {
  return pathname === "/trainer" || pathname.startsWith("/trainer/") ? "trainer" : "website";
}

/** True when the visitor has asked not to be tracked. */
function optedOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  return (
    nav.globalPrivacyControl === true ||
    nav.doNotTrack === "1" ||
    nav.doNotTrack === "yes" ||
    win.doNotTrack === "1" ||
    nav.msDoNotTrack === "1"
  );
}

function run(fn: (p: PostHog) => void) {
  if (ph) return fn(ph);
  // Child effects (a page's `ReviewOpened`, the dashboard's `TrainerIdentify`) run before the
  // root layout's <AnalyticsProvider /> effect, so the first calls can land before init.
  // Start here instead of dropping them; initAnalytics is a no-op without a key or when opted out.
  if (!started && typeof window !== "undefined") initAnalytics(window.location.pathname);
  if (started) queue.push(fn);
}

function superProps(surface: AnalyticsSurface, signedIn: boolean): AnalyticsSuperProps {
  return { surface, platform: "web", signed_in: signedIn };
}

/** Starts PostHog once. Safe to call on every render or route change. */
export function initAnalytics(pathname: string): void {
  if (started || !KEY || optedOut()) return;
  started = true;
  const surface = surfaceFor(pathname);
  persistent = surface === "trainer";
  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: API_HOST,
        ui_host: UI_HOST,
        person_profiles: "identified_only",
        persistence: surface === "trainer" ? "localStorage+cookie" : "memory",
        cross_subdomain_cookie: false,
        respect_dnt: true,
        // Pageviews come from the App Router (PageviewTracker); clicks from our own
        // delegated [data-track] listener, which sends typed events with ids only.
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_exceptions: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
      });
      // A returning trainer arrives already identified (persisted): keep `signed_in` true so
      // the first events of the page load aren't stamped as anonymous.
      posthog.register(superProps(surface, posthog.get_property("$user_state") === "identified"));
      ph = posthog;
      const pending = queue;
      queue = [];
      pending.forEach((fn) => fn(posthog));
    })
    .catch(() => {
      // Blocked or offline: analytics must never break the page.
      started = false;
      queue = [];
    });
}

/** Called on every route change: keeps `surface` right and upgrades persistence for /trainer. */
export function enterSurface(pathname: string): void {
  const surface = surfaceFor(pathname);
  run((p) => {
    p.register({ surface });
    if (surface === "trainer") {
      if (!persistent) {
        persistent = true;
        p.set_config({ persistence: "localStorage+cookie" });
      }
    } else if (persistent) {
      // Left the dashboard for a marketing page: wipe what the dashboard stored, then go
      // cookieless again.
      persistent = false;
      identifiedAs = null;
      p.reset();
      p.set_config({ persistence: "memory" });
      p.register(superProps("website", false));
    }
  });
}

let lastPageview = "";

export function pageview(): void {
  // React Strict Mode runs effects twice in dev; one URL, one pageview.
  const url = window.location.href;
  if (url === lastPageview) return;
  lastPageview = url;
  run((p) => p.capture("$pageview"));
}

export const track: TrackFn = (name, ...args) => {
  const props = scrubProps(args[0]);
  run((p) => p.capture(name, props));
};

/**
 * Identify a signed-in person by their Supabase uuid. No email, no names. `person` is
 * optional so a sign-in form that doesn't know the role yet can attribute its own event
 * without guessing; call again with props once it's known.
 */
export function identify(userId: string, person?: AnalyticsPersonProps): void {
  run((p) => {
    const props = person ? scrubProps(person) : undefined;
    if (identifiedAs !== userId) {
      identifiedAs = userId;
      p.register({ signed_in: true });
      p.identify(userId, props);
    } else if (props) {
      p.setPersonProperties(props);
    }
  });
}

export function resetAnalytics(): void {
  run((p) => {
    identifiedAs = null;
    p.reset();
    p.register(superProps(surfaceFor(window.location.pathname), false));
  });
}

/** The visitor's anonymous id and session id, for the CTA bridge. Null until PostHog is up. */
export function bridgeIds(): { distinctId: string; sessionId: string } | null {
  if (!ph) return null;
  const distinctId = ph.get_distinct_id();
  const sessionId = ph.get_session_id();
  return distinctId && sessionId ? { distinctId, sessionId } : null;
}
