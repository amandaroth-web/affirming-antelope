import { bearer } from "@/lib/ai/auth";
import { ApiError, errorResponse, jsonResponse, optionsResponse, readJson } from "@/lib/ai/http";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

const fail = (status: number, code: string, message: string) => new ApiError(status, message, undefined, { code });

/**
 * POST /api/account/merge-anonymous
 *
 * A guest (anonymous Supabase user) signed in to an email that already has an
 * account. Moves the guest's practice into that account, then deletes the guest.
 *
 *   Authorization: Bearer <the permanent account's access token>
 *   { "anonymousAccessToken": "<the guest's access token, captured before switching>" }
 *
 * -> 200 { merged, learnerState: "merged" | "moved" | "none", completionsMoved,
 *          sessionsMoved, anonymousUserDeleted }
 *
 * Both tokens are checked with Supabase Auth (signature, expiry, session not signed
 * out, user still exists), so a token for a user who was already converted or
 * deleted is refused. Error codes: docs/anonymous-auth.md.
 */
export async function POST(req: Request) {
  try {
    const admin = getAdminClient();
    if (!admin) {
      console.error("[account] merge-anonymous needs SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).");
      throw fail(503, "merge_unavailable", "Bringing guest progress into an account isn't available right now.");
    }

    const token = bearer(req);
    if (!token) throw fail(401, "auth_required", "Sign in to the account first.");

    const body = await readJson(req);
    const anonToken =
      body && typeof body === "object" ? (body as Record<string, unknown>).anonymousAccessToken : undefined;
    if (typeof anonToken !== "string" || !anonToken.trim() || anonToken.length > 8192) {
      throw fail(400, "anonymous_token_required", "anonymousAccessToken is required.");
    }
    if (anonToken.trim() === token) throw fail(400, "same_user", "The two tokens are the same user.");

    const [perm, anon] = await Promise.all([admin.auth.getUser(token), admin.auth.getUser(anonToken.trim())]);

    const permUser = perm.data?.user;
    if (perm.error || !permUser) throw fail(401, "invalid_token", "invalid_token");
    if (permUser.is_anonymous) throw fail(403, "account_required", "Sign in to the account first.");

    const anonUser = anon.data?.user;
    if (anon.error || !anonUser) {
      throw fail(401, "invalid_anonymous_token", "The guest session has expired or was signed out.");
    }
    if (!anonUser.is_anonymous) throw fail(409, "not_anonymous", "That guest session already belongs to an account.");
    if (anonUser.id === permUser.id) throw fail(400, "same_user", "The two tokens are the same user.");

    const { data, error } = await admin.rpc("merge_anonymous_user", {
      anonymous_id: anonUser.id,
      permanent_id: permUser.id,
    });
    if (error) {
      if (error.code === "PT404") throw fail(404, "not_found", "That guest no longer exists.");
      if (error.code === "PT409") {
        const code = error.hint === "not_permanent" ? "account_required" : "not_anonymous";
        throw fail(409, code, error.message);
      }
      console.error(`[account] merge_anonymous_user failed: ${error.code ?? "?"}`);
      throw fail(500, "merge_failed", "Couldn't bring the guest progress over. Please try again.");
    }
    const summary = (data ?? {}) as { learner_state?: string; completions_moved?: number; sessions_moved?: number };

    // The data is already in the account; a failed delete only leaves an empty guest
    // behind (cleaned up by the stale-anonymous-user job, docs/anonymous-auth.md).
    let anonymousUserDeleted = true;
    const del = await admin.auth.admin.deleteUser(anonUser.id);
    if (del.error) {
      anonymousUserDeleted = false;
      console.error(`[account] deleting merged anonymous user failed: ${del.error.status ?? "?"}`);
    }

    return jsonResponse(req, {
      merged: true,
      learnerState: summary.learner_state ?? "none",
      completionsMoved: summary.completions_moved ?? 0,
      sessionsMoved: summary.sessions_moved ?? 0,
      anonymousUserDeleted,
    });
  } catch (err) {
    return errorResponse(req, err);
  }
}
