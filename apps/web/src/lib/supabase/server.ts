import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@antelope/core";
import { requireSupabaseEnv } from "./env";

/**
 * Server client for Server Components, Server Actions and Route Handlers. Create one
 * per request (never share across requests). Writing cookies throws during Server
 * Component render; that's fine because proxy.ts refreshes the session first.
 */
export async function createClient() {
  const { url, key } = requireSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: proxy.ts already refreshed the session.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
