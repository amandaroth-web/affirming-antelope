"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { enterSurface, initAnalytics, pageview } from "@/lib/analytics/client";
import { installClickTracking } from "@/lib/analytics/dom";

/**
 * Mounts PostHog for the whole site (docs/tracking-plan.md). Render once inside <body>.
 * Renders nothing; without NEXT_PUBLIC_POSTHOG_KEY it does nothing at all.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics(pathname);
    installClickTracking();
    // Init only reads the first pathname. Later route changes are handled by PageviewTracker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  );
}

/** One $pageview per pathname or query change (the App Router never reloads the page). */
function PageviewTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    enterSurface(pathname);
    pageview();
  }, [pathname, search]);

  return null;
}
