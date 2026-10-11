import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@antelope/core";
import { supabaseEnv } from "./env";

/**
 * Supabase secret key, server only: SUPABASE_SECRET_KEY (sb_secret_...) or the
 * legacy SUPABASE_SERVICE_ROLE_KEY JWT. It bypasses RLS, so it must never reach a
 * browser bundle (no NEXT_PUBLIC_ prefix) and is used for exactly two things:
 *   - POST /api/account/merge-anonymous (merge_anonymous_user + deleting the guest)
 *   - the legacy x-antelope-key per-IP quota (consume_legacy_ai_quota)
 */
export function secretKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

let admin: SupabaseClient<Database> | null = null;

/** Service-role client, or null when the URL or the secret key is missing. */
export function getAdminClient(): SupabaseClient<Database> | null {
  if (admin) return admin;
  const env = supabaseEnv();
  const key = secretKey();
  if (!env || !key) return null;
  admin = createClient<Database>(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}
