"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/client";

/** `review_opened` when a trainer opens a submission. Sends the wait in hours, no ids of people. */
export function ReviewOpened({ submittedAt }: { submittedAt: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const hours = (Date.now() - Date.parse(submittedAt)) / 3_600_000;
    if (Number.isFinite(hours)) track("review_opened", { hours_since_submitted: Math.max(0, Math.round(hours * 10) / 10) });
  }, [submittedAt]);
  return null;
}
