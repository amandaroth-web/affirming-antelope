"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getAdmin } from "@/lib/trainer/admin";
import { isUuid } from "@/lib/trainer/dal";
import { CODE_ALPHABET, cleanCodeSuffix } from "@/lib/trainer/access";
import { sendEmail } from "@/lib/email/send";
import { trainerApprovedEmail } from "@/lib/email/templates";
import type { ActionResult } from "@/app/trainer/actions";

// Admin-only Server Actions. Each one re-checks the caller with getAdmin() (verified
// user + ADMIN_EMAILS) before touching the service-role client, because a Server
// Action is a public POST endpoint whatever page rendered it.

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function adminContext() {
  const admin = await getAdmin();
  if (!admin) return null;
  const db = getAdminClient();
  if (!db) return null;
  return { admin, db };
}

const NOT_ALLOWED = "Only admins can do that.";

async function decide(requestId: string, approve: boolean): Promise<ActionResult<{ status: string }>> {
  const ctx = await adminContext();
  if (!ctx) return fail(NOT_ALLOWED);
  if (!isUuid(requestId)) return fail("Unknown request.");

  const { data, error } = await ctx.db.rpc("admin_decide_trainer_request", {
    request_id: requestId,
    approve,
    admin_id: ctx.admin.id,
  });
  if (error) {
    if (error.code === "PT409") return fail("Someone already decided this one. Refresh to see it.");
    if (error.code === "PT404") return fail("That request is gone. Refresh the page.");
    return fail("We couldn't save that. Try again.");
  }

  const result = data as { status: string; name: string; email: string | null };
  if (approve && result.email) {
    const to = result.email;
    after(() => sendEmail({ to, ...trainerApprovedEmail(result.name) }).then(() => undefined));
  }
  revalidatePath("/trainer/admin");
  return { ok: true, data: { status: result.status } };
}

export async function approveTrainerRequest(requestId: string) {
  return decide(requestId, true);
}

export async function declineTrainerRequest(requestId: string) {
  return decide(requestId, false);
}

function randomSuffix(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

export interface NewTrainerCode {
  code: string;
  maxUses: number | null;
  expiresAt: string | null;
}

export async function createTrainerCode(input: {
  suffix?: string;
  maxUses?: number | null;
  expiresOn?: string | null;
  note?: string;
}): Promise<ActionResult<NewTrainerCode>> {
  const ctx = await adminContext();
  if (!ctx) return fail(NOT_ALLOWED);

  const rawSuffix = String(input.suffix ?? "").trim();
  const custom = rawSuffix ? cleanCodeSuffix(rawSuffix) : null;
  if (rawSuffix && !custom) return fail("Use 3 to 20 letters or digits after TRAIN-, like TRAIN-AMANDA.");

  const maxUses = input.maxUses == null || Number.isNaN(input.maxUses) ? null : Math.trunc(input.maxUses);
  if (maxUses !== null && (maxUses < 1 || maxUses > 10_000)) return fail("Max uses is a number from 1 to 10,000, or blank for no limit.");

  let expiresAt: string | null = null;
  if (input.expiresOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn)) return fail("Pick an expiry date, or leave it blank.");
    // The code works through the end of that day (UTC).
    const end = new Date(`${input.expiresOn}T23:59:59.999Z`);
    if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) return fail("Pick an expiry date in the future.");
    expiresAt = end.toISOString();
  }

  const note = String(input.note ?? "").trim();
  if (note.length > 200) return fail("Keep the note under 200 characters.");

  // A random code can collide with an existing one; try a few before giving up.
  for (let attempt = 0; attempt < (custom ? 1 : 5); attempt++) {
    const code = `TRAIN-${custom ?? randomSuffix()}`;
    const { data, error } = await ctx.db.rpc("admin_create_trainer_code", {
      new_code: code,
      use_limit: maxUses ?? undefined,
      valid_until: expiresAt ?? undefined,
      label: note || undefined,
    });
    if (!error) {
      const row = data?.[0];
      revalidatePath("/trainer/admin");
      return { ok: true, data: { code: row?.code ?? code, maxUses: row?.max_uses ?? maxUses, expiresAt: row?.expires_at ?? expiresAt } };
    }
    if (error.code !== "23505") return fail("We couldn't create that code. Try again.");
    if (custom) return fail(`${code} already exists. Pick another suffix.`);
  }
  return fail("We couldn't find a free random code. Try again.");
}
