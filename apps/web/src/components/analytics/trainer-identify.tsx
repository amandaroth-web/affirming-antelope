"use client";

import { useEffect } from "react";
import { identify } from "@/lib/analytics/client";

/**
 * Identifies the signed-in trainer by their Supabase user uuid, nothing else.
 * Never pass an email or a display name here.
 */
export function TrainerIdentify({ userId }: { userId: string }) {
  useEffect(() => {
    identify(userId, { role: "trainer", is_trainer: true });
  }, [userId]);
  return null;
}
