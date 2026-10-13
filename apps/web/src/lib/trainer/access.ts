/**
 * Trainer access: shared vocabulary for the request form, the code box and the admin
 * page. Pure functions, safe on the client and the server. The database enforces the
 * same rules (supabase/migrations/20261014120000_trainer_access_requests.sql).
 */

import type { TrainerLearnerCount } from "@antelope/core";

export const LEARNER_COUNTS: { value: TrainerLearnerCount; label: string }[] = [
  { value: "1-10", label: "1–10" },
  { value: "11-30", label: "11–30" },
  { value: "31-100", label: "31–100" },
  { value: "100+", label: "100+" },
];

export function isLearnerCount(v: unknown): v is TrainerLearnerCount {
  return LEARNER_COUNTS.some((c) => c.value === v);
}

export function learnerCountLabel(v: string): string {
  return LEARNER_COUNTS.find((c) => c.value === v)?.label ?? v;
}

export const NOTE_MAX = 500;
export const NAME_MAX = 80;
export const ORGANIZATION_MAX = 120;

/** After a decline, a new request is allowed once this much time has passed (DB trigger too). */
export const DECLINE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function nextRequestAllowedAt(declinedAt: string): Date {
  return new Date(new Date(declinedAt).getTime() + DECLINE_COOLDOWN_MS);
}

/** When a declined request was decided less than 7 days ago, the date a new one is allowed. */
export function declineCooldownUntil(declinedAt: string | null, now = Date.now()): Date | null {
  if (!declinedAt) return null;
  const until = nextRequestAllowedAt(declinedAt);
  return until.getTime() > now ? until : null;
}

/** Six digits: the sign-in code from the email, typed into the wrong box. */
export function looksLikeSignInCode(input: string): boolean {
  return /^\d{6}$/.test(input.replace(/\s+/g, ""));
}

/**
 * "train-ab12cd", "TRAIN AB12CD", "trainab12cd" and "ab12cd" all become "TRAIN-AB12CD".
 * Returns "" for empty input.
 */
export function normalizeTrainerCode(input: string): string {
  const s = input.toUpperCase().replace(/\s+/g, "").replace(/[‐‑–—]/g, "-");
  if (!s) return "";
  const rest = s.replace(/^TRAIN-?/, "");
  return `TRAIN-${rest.replace(/^-+/, "")}`;
}

/** Characters for random codes: no 0/O, 1/I/L, so a code survives being read aloud. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A custom suffix as typed by an admin, cleaned up, or null when it can't be a code. */
export function cleanCodeSuffix(input: string): string | null {
  const s = input.toUpperCase().trim().replace(/^TRAIN-?/, "");
  return /^[A-Z0-9]{3,20}$/.test(s) ? s : null;
}
