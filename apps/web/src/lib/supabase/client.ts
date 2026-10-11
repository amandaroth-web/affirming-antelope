"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@antelope/core";

/** Browser client. Session lives in cookies so Server Components see the same user. */
export function createClient() {
  // Inlined at build time; must be literal property accesses.
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
