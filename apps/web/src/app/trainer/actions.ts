"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer, isUuid } from "@/lib/trainer/dal";
import { RATINGS, validateItem, type ItemDraft, type ItemKind } from "@/lib/trainer/content";
import { getDrill, getLesson, getScenario, type SkillId } from "@antelope/core";

// Every action re-checks the session (Server Actions are public POST endpoints) and
// relies on RLS for row access. Returns are shaped for the UI, never raw rows.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function trainerClient() {
  const viewer = await getViewer();
  if (!viewer) return null;
  return { viewer, supabase: await createClient() };
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/trainer/sign-in");
}

// ---------------------------------------------------------------------------
// Becoming a trainer
// ---------------------------------------------------------------------------

export async function claimTrainer(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ctx = await trainerClient();
  if (!ctx) return fail("Your session ended. Sign in again.");
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const name = String(form.get("displayName") ?? "").trim();
  if (!code) return fail("Enter the trainer code you were given.");
  if (name.length > 80) return fail("Keep your name under 80 characters.");

  const { data, error } = await ctx.supabase.rpc("claim_trainer", { code });
  if (error) return fail("We couldn't check that code. Try again in a moment.");
  if (!data) return fail("That code didn't work. Check it with whoever sent it, or ask for a new one.");

  if (name && name !== ctx.viewer.displayName) {
    await ctx.supabase.from("profiles").update({ display_name: name }).eq("id", ctx.viewer.id);
  }
  revalidatePath("/trainer", "layout");
  redirect("/trainer?welcome=1");
}

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

export async function createCohort(input: { name: string; startsOn?: string | null }): Promise<
  ActionResult<{ id: string; name: string; joinCode: string }>
> {
  const ctx = await trainerClient();
  if (!ctx) return fail("Your session ended. Sign in again.");
  const name = String(input.name ?? "").trim();
  if (!name) return fail("Give the cohort a name.");
  if (name.length > 120) return fail("Keep the name under 120 characters.");
  const startsOn = input.startsOn && /^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) ? input.startsOn : undefined;

  const { data, error } = await ctx.supabase.rpc("create_cohort", { name, starts_on: startsOn });
  if (error) {
    return fail(error.code === "42501" ? "Only trainers can create cohorts." : "We couldn't create the cohort. Try again.");
  }
  // No revalidatePath here: re-rendering now would unmount the dialog that shows the
  // new join code (the empty state becomes a list). The client refreshes on close.
  return { ok: true, data: { id: data.id, name: data.name, joinCode: data.join_code } };
}

export async function rotateJoinCode(cohortId: string): Promise<ActionResult<{ joinCode: string }>> {
  const ctx = await trainerClient();
  if (!ctx) return fail("Your session ended. Sign in again.");
  if (!isUuid(cohortId)) return fail("Unknown cohort.");
  const { data, error } = await ctx.supabase.rpc("rotate_join_code", { cohort_id: cohortId });
  if (error || !data) return fail("Only this cohort's trainer can make a new code.");
  // The caller shows the new code itself; pages read the code fresh on their next render.
  return { ok: true, data: { joinCode: data } };
}

export async function setCohortArchived(cohortId: string, archived: boolean): Promise<ActionResult> {
  const ctx = await trainerClient();
  if (!ctx) return fail("Your session ended. Sign in again.");
  if (!isUuid(cohortId)) return fail("Unknown cohort.");
  const { data, error } = await ctx.supabase
    .from("cohorts")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", cohortId)
    .select("id");
  if (error || !data?.length) return fail("We couldn't update that cohort.");
  revalidatePath("/trainer", "layout");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

const ITEM_KINDS: ItemKind[] = ["drill", "roleplay", "learn", "any-drill", "any-roleplay"];

export async function createAssignment(input: {
  cohortId: string;
  title: string;
  instructions: string;
  dueAt: string | null;
  items: ItemDraft[];
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await trainerClient();
  if (!ctx) return fail("Your session ended. Sign in again.");
  if (!isUuid(input.cohortId)) return fail("Unknown cohort.");

  const title = String(input.title ?? "").trim();
  const instructions = String(input.instructions ?? "").trim();
  if (!title) return fail("Give the assignment a title.");
  if (title.length > 200) return fail("Keep the title under 200 characters.");
  if (instructions.length > 4000) return fail("Keep the instructions under 4,000 characters.");
  let dueAt: string | null = null;
  if (input.dueAt) {
    const d = new Date(input.dueAt);
    if (Number.isNaN(d.getTime())) return fail("That due date doesn't look right.");
    dueAt = d.toISOString();
  }

  const items = Array.isArray(input.items) ? input.items.slice(0, 20) : [];
  if (!items.length) return fail("Add at least one practice.");
  const clean: ItemDraft[] = [];
  for (const raw of items) {
    const item: ItemDraft = {
      kind: ITEM_KINDS.includes(raw?.kind) ? raw.kind : "drill",
      refId: typeof raw?.refId === "string" && raw.refId ? raw.refId : null,
      skill: typeof raw?.skill === "string" && raw.skill ? (raw.skill as SkillId) : null,
      quantity: Number(raw?.quantity ?? 1),
    };
    // Specific items carry their content's skill so the row reads well in SQL.
    if (item.kind === "drill" && item.refId) item.skill = getDrill(item.refId)?.skill ?? null;
    if (item.kind === "roleplay" && item.refId) item.skill = getScenario(item.refId)?.primaryChallenge ?? null;
    if (item.kind === "learn" && item.refId && !getLesson(item.refId)) return fail("Unknown lesson.");
    if (item.kind === "learn") item.skill = null;
    const problem = validateItem(item);
    if (problem) return fail(problem);
    clean.push(item);
  }

  const { data: created, error } = await ctx.supabase
    .from("assignments")
    .insert({ cohort_id: input.cohortId, title, instructions, due_at: dueAt, created_by: ctx.viewer.id })
    .select("id")
    .single();
  if (error || !created) return fail("We couldn't create the assignment. Only this cohort's trainer can.");

  const { error: itemsError } = await ctx.supabase.from("assignment_items").insert(
    clean.map((i, position) => ({
      assignment_id: created.id,
      kind: i.kind,
      ref_id: i.kind.startsWith("any-") ? null : i.refId,
      skill: i.skill,
      quantity: i.quantity,
      position,
    })),
  );
  if (itemsError) {
    await ctx.supabase.from("assignments").delete().eq("id", created.id);
    return fail("We couldn't save the practices on that assignment. Nothing was published.");
  }

  revalidatePath(`/trainer/cohorts/${input.cohortId}`, "layout");
  return { ok: true, data: { id: created.id } };
}

export async function archiveAssignment(assignmentId: string, cohortId: string): Promise<ActionResult> {
  const ctx = await trainerClient();
  if (!ctx) return fail("Your session ended. Sign in again.");
  if (!isUuid(assignmentId) || !isUuid(cohortId)) return fail("Unknown assignment.");
  const { data, error } = await ctx.supabase
    .from("assignments")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("cohort_id", cohortId)
    .select("id");
  if (error || !data?.length) return fail("We couldn't archive that assignment.");
  revalidatePath(`/trainer/cohorts/${cohortId}`, "layout");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface SaveReviewInput {
  submissionId: string;
  feedback: string;
  rating: string | null;
  recommendedKind: "learn" | "drill" | "roleplay" | null;
  recommendedRef: string | null;
  tryAgain: boolean;
  /** "keep" the stored clip, "remove" it, or a new storage path already uploaded. */
  audio: { action: "keep" } | { action: "remove" } | { action: "replace"; path: string };
}

export async function saveReview(
  input: SaveReviewInput,
): Promise<ActionResult<{ reviewId: string; updatedAt: string; audioPath: string | null }>> {
  const ctx = await trainerClient();
  if (!ctx) return fail("Your session ended. Sign in again, then save. Your draft is still here.");
  if (!isUuid(input.submissionId)) return fail("Unknown submission.");

  const feedback = String(input.feedback ?? "").trim();
  if (feedback.length > 10000) return fail("Keep written feedback under 10,000 characters.");
  const rating = input.rating && RATINGS.some((r) => r.id === input.rating) ? input.rating : null;
  let recommendedKind = input.recommendedKind;
  let recommendedRef = input.recommendedRef;
  if (recommendedKind || recommendedRef) {
    const valid =
      (recommendedKind === "drill" && recommendedRef && getDrill(recommendedRef)) ||
      (recommendedKind === "roleplay" && recommendedRef && getScenario(recommendedRef)) ||
      (recommendedKind === "learn" && recommendedRef && getLesson(recommendedRef));
    if (!valid) return fail("That recommendation isn't in the practice library.");
  } else {
    recommendedKind = null;
    recommendedRef = null;
  }

  // RLS: only visible if it was submitted to a cohort this trainer trains.
  const { data: sub } = await ctx.supabase
    .from("submissions")
    .select("id, cohort_id, status, reviews(id, audio_path, trainer_id)")
    .eq("id", input.submissionId)
    .maybeSingle();
  if (!sub) return fail("This submission isn't available. It may have been withdrawn.");
  const existing = Array.isArray(sub.reviews) ? sub.reviews[0] : sub.reviews;
  if (existing && existing.trainer_id !== ctx.viewer.id) return fail("Another trainer has already reviewed this submission.");

  let audioPath: string | null = existing?.audio_path ?? null;
  if (input.audio.action === "remove") audioPath = null;
  if (input.audio.action === "replace") {
    const prefix = `${sub.cohort_id}/${sub.id}/`;
    const rest = input.audio.path.slice(prefix.length);
    if (!input.audio.path.startsWith(prefix) || !/^[0-9a-f-]{36}\.(webm|m4a)$/.test(rest)) {
      return fail("That recording didn't upload to the right place. Record it again.");
    }
    audioPath = input.audio.path;
  }
  if (!feedback && !audioPath) return fail("Add written or audio feedback before saving.");

  const row = {
    feedback,
    audio_path: audioPath,
    rating,
    recommended_kind: recommendedKind,
    recommended_ref: recommendedRef,
    try_again: !!input.tryAgain,
  };

  const result = existing
    ? await ctx.supabase.from("reviews").update(row).eq("id", existing.id).select("id, updated_at, audio_path").single()
    : await ctx.supabase
        .from("reviews")
        .insert({ ...row, submission_id: sub.id, trainer_id: ctx.viewer.id })
        .select("id, updated_at, audio_path")
        .single();
  if (result.error || !result.data) return fail("We couldn't save the review. Try again.");

  // Tidy a replaced or removed clip. Best effort: the review row is what matters.
  const old = existing?.audio_path;
  if (old && old !== audioPath) await ctx.supabase.storage.from("review-audio").remove([old]);

  revalidatePath("/trainer", "layout");
  return {
    ok: true,
    data: { reviewId: result.data.id, updatedAt: result.data.updated_at, audioPath: result.data.audio_path },
  };
}
