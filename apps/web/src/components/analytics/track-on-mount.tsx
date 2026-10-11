"use client";

import type { AnalyticsArgs, AnalyticsEventName, AnalyticsEvents } from "@antelope/core";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/client";

/**
 * Fires one event when it mounts (a server component can render it with ids only).
 * `once` de-duplicates across remounts and refreshes within the tab session.
 */
export function TrackOnMount<E extends AnalyticsEventName>({
  event,
  props,
  once,
}: {
  event: E;
  props?: AnalyticsEvents[E];
  once?: string;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    if (once) {
      const key = `analytics:${once}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // storage blocked: fall through and fire once for this mount
      }
    }
    track(event, ...([props] as AnalyticsArgs<E>));
    // props are fixed at render time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
