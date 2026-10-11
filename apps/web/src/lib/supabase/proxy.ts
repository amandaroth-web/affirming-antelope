import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@antelope/core";
import { supabaseEnv } from "./env";

/**
 * Refreshes the Supabase session once per navigation and mirrors the refreshed
 * cookies onto both the forwarded request (so Server Components read fresh tokens)
 * and the response (so the browser stores them). Returns the response plus the
 * verified user id, or null when signed out. This is an optimistic check only;
 * every page and Server Action re-verifies through the DAL.
 */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; userId: string | null }> {
  let response = NextResponse.next({ request });
  const env = supabaseEnv();
  if (!env) return { response, userId: null };

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache-Control etc., so a CDN never caches a response carrying auth cookies.
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // Don't put code between createServerClient and getClaims: it does the refresh.
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { response, userId };
}
