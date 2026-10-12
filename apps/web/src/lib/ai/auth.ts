import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@antelope/core";
import { getAdminClient } from "@/lib/supabase/admin";
import { supabaseEnv } from "@/lib/supabase/env";
import { ApiError, appTokenMatches, clientIpHash, rateLimitKey } from "./http";

/**
 * Who is calling an AI route.
 *
 * - user: a Supabase access token in `Authorization: Bearer`, anonymous (guest,
 *   from signInAnonymously) or permanent. Required for everyone. Verified here, and
 *   again by PostgREST when the quota is charged with the same token.
 * - legacy: the old shared `x-antelope-key` app token, accepted for a short
 *   transition with a tiny per-IP quota. See LEGACY_APP_TOKEN_SUNSET.
 * - dev: local development with no Supabase configured at all. In-memory limits.
 *
 * A bearer token that doesn't verify is a 401, never a fall-back to anything else.
 * Design: docs/anonymous-auth.md.
 */
export type Caller =
  | { kind: "user"; userId: string; isAnonymous: boolean; token: string }
  | { kind: "legacy"; ipHash: string }
  | { kind: "dev" };

export type QuotaBucket = "turn" | "debrief" | "drill" | "stt" | "tts";

type QuotaResult = {
  allowed: boolean;
  reason: "daily" | "burst" | "global" | null;
  limit: number;
  remaining: number;
  retry_after: number;
};

// TODO(2026-10-25): remove the legacy x-antelope-key path: this constant,
// legacyAppTokenAllowed(), the "legacy" Caller, appTokenMatches/clientIpHash in
// ./http.ts, consume_legacy_ai_quota + app_private.ai_usage_legacy_ip (new
// migration), APP_CLIENT_TOKEN / ALLOW_LEGACY_APP_TOKEN, and x-antelope-key in CORS.
const LEGACY_APP_TOKEN_SUNSET = Date.parse("2026-10-25T00:00:00Z");

/**
 * ALLOW_LEGACY_APP_TOKEN=1 keeps the old guest path open, =0 closes it. Unset: open
 * until LEGACY_APP_TOKEN_SUNSET, then closed, so forgetting to flip it fails safe.
 */
export function legacyAppTokenAllowed(now = Date.now()): boolean {
  const flag = process.env.ALLOW_LEGACY_APP_TOKEN?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return now < LEGACY_APP_TOKEN_SUNSET;
}

const SIGN_IN_REQUIRED = "Sign in to use practice AI.";

let verifier: SupabaseClient<Database> | null = null;

function getVerifier(): SupabaseClient<Database> | null {
  if (verifier) return verifier;
  const env = supabaseEnv();
  if (!env) return null;
  // Stateless: never stores or refreshes a session; only verifies JWTs it's handed.
  verifier = createClient<Database>(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return verifier;
}

/** The bearer token, or null when there's no Authorization header. A malformed header is a 401. */
export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  if (!m) throw new ApiError(401, "invalid_token", undefined, { code: "invalid_token" });
  return m[1].trim();
}

/** Verifies a Supabase access token. getClaims checks the signature against the project's JWKS (cached) and expiry. */
async function verify(token: string): Promise<{ userId: string; isAnonymous: boolean }> {
  const client = getVerifier();
  const invalid = new ApiError(401, "invalid_token", undefined, { code: "invalid_token" });
  if (!client) throw invalid;
  try {
    const { data, error } = await client.auth.getClaims(token);
    const claims = data?.claims;
    if (error || typeof claims?.sub !== "string" || claims.role !== "authenticated") throw invalid;
    // Fail closed like the database: no claim counts as anonymous (the lower tier).
    return { userId: claims.sub, isAnonymous: claims.is_anonymous !== false };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw invalid;
  }
}

/** Identify the caller. Throws 401 when there is no acceptable credential. */
export async function authenticate(req: Request): Promise<Caller> {
  const token = bearer(req);
  if (token) {
    const { userId, isAnonymous } = await verify(token);
    return { kind: "user", userId, isAnonymous, token };
  }

  if (req.headers.has("x-antelope-key") && legacyAppTokenAllowed()) {
    if (!appTokenMatches(req)) throw new ApiError(401, "unauthorized", undefined, { code: "invalid_app_token" });
    return { kind: "legacy", ipHash: clientIpHash(req) };
  }

  if (!supabaseEnv() && process.env.NODE_ENV !== "production") return { kind: "dev" };

  throw new ApiError(401, SIGN_IN_REQUIRED, undefined, { code: "auth_required" });
}

// Dev-only in-memory limits (per minute), the old guest numbers.
const DEV_PER_MINUTE: Record<QuotaBucket, number> = { turn: 40, debrief: 8, drill: 30, stt: 10, tts: 60 };

function deniedError(bucket: QuotaBucket, caller: Caller, q: QuotaResult): ApiError {
  const retry = Math.max(1, Math.round(q.retry_after || 60));
  const headers = { "Retry-After": String(retry) };
  const fields = { reason: q.reason, retry_after: retry, limit: q.limit, remaining: Math.max(0, q.remaining) };
  if (q.reason === "global") {
    return new ApiError(503, "Practice AI is resting. Please try again later.", headers, {
      code: "ai_resting",
      ...fields,
    });
  }
  let message: string;
  if (bucket === "stt" || bucket === "tts") {
    message =
      q.reason === "burst"
        ? "That's a lot of talking in a short time. Take a breath and try again in a moment."
        : caller.kind === "user" && caller.isAnonymous
          ? "You've used today's free voice practice. You can keep going by typing, sign in with your email for more, or come back tomorrow."
          : "You've used today's voice practice. You can keep going by typing; voice resets tomorrow.";
  } else if (q.reason === "burst") {
    message = "That's a lot of practice in a short time. Take a breath and try again in a moment.";
  } else if (caller.kind === "user" && caller.isAnonymous) {
    message =
      bucket === "debrief"
        ? "You've used today's free debriefs. Sign in with your email for more, or come back tomorrow."
        : "You've reached today's free practice limit. Sign in with your email for more, or come back tomorrow.";
  } else {
    message =
      bucket === "debrief"
        ? "You've used today's debriefs. They reset tomorrow."
        : "You've reached today's practice limit. It resets tomorrow.";
  }
  return new ApiError(429, message, headers, { code: "quota_exceeded", ...fields });
}

function unavailable(): ApiError {
  return new ApiError(503, "Practice AI is temporarily unavailable. Please try again in a moment.", { "Retry-After": "30" }, {
    code: "quota_unavailable",
    retry_after: 30,
  });
}

/**
 * Charge one unit of `bucket` to the caller, durably and atomically
 * (public.consume_ai_quota). Call it after validating the request and right before
 * the AI call. Returns headers describing what's left. Fails closed: if the quota
 * can't be checked, the AI isn't called.
 */
export async function chargeQuota(caller: Caller, bucket: QuotaBucket): Promise<Record<string, string>> {
  let result: QuotaResult;

  if (caller.kind === "dev") {
    rateLimitKey(`${bucket}:dev`, DEV_PER_MINUTE[bucket]);
    return {};
  }

  if (caller.kind === "user") {
    const env = supabaseEnv();
    if (!env) throw unavailable();
    // The user's own JWT, so auth.uid() inside the function is the caller and can't be spoofed.
    const client = createClient<Database>(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${caller.token}` } },
    });
    const { data, error } = await client.rpc("consume_ai_quota", { bucket });
    if (error) {
      if (error.code === "PGRST301" || error.code === "PGRST303" || error.code === "42501") {
        throw new ApiError(401, "invalid_token", undefined, { code: "invalid_token" });
      }
      console.error(`[ai] consume_ai_quota failed: ${error.code ?? "?"}`);
      throw unavailable();
    }
    result = data as unknown as QuotaResult;
  } else {
    // TODO(2026-10-25): legacy path, remove.
    const admin = getAdminClient();
    if (!admin) {
      console.error("[ai] Legacy app token needs SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) for its quota.");
      throw unavailable();
    }
    const { data, error } = await admin.rpc("consume_legacy_ai_quota", { ip_hash: caller.ipHash, bucket });
    if (error) {
      console.error(`[ai] consume_legacy_ai_quota failed: ${error.code ?? "?"}`);
      throw unavailable();
    }
    result = data as unknown as QuotaResult;
  }

  if (!result || typeof result.allowed !== "boolean") throw unavailable();
  if (!result.allowed) throw deniedError(bucket, caller, result);
  return { "X-Quota-Limit": String(result.limit), "X-Quota-Remaining": String(Math.max(0, result.remaining)) };
}
