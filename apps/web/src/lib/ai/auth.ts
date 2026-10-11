import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@antelope/core";
import { supabaseEnv } from "@/lib/supabase/env";
import { ApiError, rateLimit, rateLimitKey, requireClientKey } from "./http";

/**
 * Who is calling an AI route. Either a signed-in user (Supabase access token in
 * `Authorization: Bearer`, verified server-side, limited per user) or a guest with
 * the shared `x-antelope-key` app token (limited per IP; skipped when
 * APP_CLIENT_TOKEN is unset in local dev). A bearer token that doesn't verify is a
 * 401, never a silent fall-back to guest.
 */
export type Caller = { kind: "user"; userId: string } | { kind: "guest" };

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

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  if (!m) throw new ApiError(401, "invalid_token");
  return m[1].trim();
}

/** Verifies a Supabase access token. getClaims checks the signature against the project's JWKS (cached) and expiry. */
async function verify(token: string): Promise<string> {
  const client = getVerifier();
  if (!client) throw new ApiError(401, "invalid_token");
  try {
    const { data, error } = await client.auth.getClaims(token);
    const sub = data?.claims?.sub;
    if (error || typeof sub !== "string" || data?.claims?.role !== "authenticated") throw new ApiError(401, "invalid_token");
    return sub;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, "invalid_token");
  }
}

/**
 * Authenticate and rate-limit one AI request. Signed-in users get `userMax`
 * (defaults to the guest limit) requests per minute per account.
 */
export async function authorize(
  req: Request,
  bucket: string,
  limits: { guestMax: number; userMax?: number },
): Promise<Caller> {
  const token = bearer(req);
  if (token) {
    const userId = await verify(token);
    rateLimitKey(`${bucket}:user:${userId}`, limits.userMax ?? limits.guestMax);
    return { kind: "user", userId };
  }
  requireClientKey(req);
  rateLimit(req, bucket, limits.guestMax);
  return { kind: "guest" };
}
