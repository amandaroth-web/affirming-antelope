import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer for the trainer dashboard. Every page and Server Action calls one
 * of these before reading or writing; proxy.ts is only an optimistic redirect. RLS
 * still decides which rows come back, so these checks are about routing the user to
 * the right screen, not the security boundary itself.
 */

export interface Viewer {
  id: string;
  email: string | null;
  displayName: string;
  canTrain: boolean;
}

/** The signed-in user (verified JWT) plus their profile, or null. Memoized per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, can_train")
    .eq("id", sub)
    .maybeSingle();
  return {
    id: sub,
    email: typeof data?.claims?.email === "string" ? data.claims.email : null,
    displayName: profile?.display_name ?? "Trainer",
    canTrain: !!profile?.can_train,
  };
});

export function signInPath(next?: string): string {
  return next && next !== "/trainer" ? `/trainer/sign-in?next=${encodeURIComponent(next)}` : "/trainer/sign-in";
}

export async function requireUser(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(signInPath(next));
  return viewer;
}

/** Signed in AND can_train. Non-trainers go to "Become a trainer". */
export async function requireTrainer(next?: string): Promise<Viewer> {
  const viewer = await requireUser(next);
  if (!viewer.canTrain) redirect("/trainer/become");
  return viewer;
}

export interface TrainerCohort {
  id: string;
  name: string;
  joinCode: string;
  startsOn: string | null;
  archivedAt: string | null;
  createdAt: string;
  pathwayId: string;
}

/** Cohort ids the viewer trains (owner or trainer member). */
export const getTrainedCohortIds = cache(async (): Promise<Set<string>> => {
  const viewer = await getViewer();
  if (!viewer) return new Set();
  const supabase = await createClient();
  const [{ data: owned }, { data: memberships }] = await Promise.all([
    supabase.from("cohorts").select("id").eq("trainer_id", viewer.id),
    supabase.from("cohort_members").select("cohort_id").eq("user_id", viewer.id).eq("role", "trainer"),
  ]);
  return new Set([...(owned ?? []).map((c) => c.id), ...(memberships ?? []).map((m) => m.cohort_id)]);
});

/** Every cohort the viewer trains, newest first. */
export const getTrainerCohorts = cache(async (): Promise<TrainerCohort[]> => {
  const ids = [...(await getTrainedCohortIds())];
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("cohorts")
    .select("id, name, join_code, starts_on, archived_at, created_at, pathway_id")
    .in("id", ids)
    .order("created_at", { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    joinCode: c.join_code,
    startsOn: c.starts_on,
    archivedAt: c.archived_at,
    createdAt: c.created_at,
    pathwayId: c.pathway_id,
  }));
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/** A cohort the viewer trains, or 404. Learners who belong to it get a 404 too. */
export async function requireTrainedCohort(cohortId: string): Promise<TrainerCohort> {
  if (!isUuid(cohortId)) notFound();
  const cohort = (await getTrainerCohorts()).find((c) => c.id === cohortId);
  if (!cohort) notFound();
  return cohort;
}

/** Submissions still waiting for a review, per cohort the viewer trains. */
export const getNeedsReviewCounts = cache(async (): Promise<Map<string, number>> => {
  const ids = [...(await getTrainedCohortIds())];
  const counts = new Map<string, number>();
  if (!ids.length) return counts;
  const supabase = await createClient();
  const { data } = await supabase.from("submissions").select("cohort_id").in("cohort_id", ids).eq("status", "submitted");
  for (const s of data ?? []) counts.set(s.cohort_id, (counts.get(s.cohort_id) ?? 0) + 1);
  return counts;
});
