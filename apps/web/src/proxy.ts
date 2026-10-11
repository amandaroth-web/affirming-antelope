import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/** Pages under /trainer that a signed-out visitor may open. */
const PUBLIC_TRAINER_PATHS = ["/trainer/sign-in"];

/**
 * Next 16 Proxy (formerly Middleware). Runs only for the trainer dashboard: refreshes
 * the Supabase session cookie and sends signed-out visitors to sign-in. This is an
 * optimistic gate; trainer rights (can_train, cohort ownership) are checked in the
 * DAL by every page and Server Action, and RLS enforces them in the database.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && !PUBLIC_TRAINER_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/trainer/sign-in";
    url.search = "";
    const next = pathname + search;
    if (next !== "/trainer") url.searchParams.set("next", next);
    const redirect = NextResponse.redirect(url);
    // Keep any cookie changes (e.g. a cleared, expired session).
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/trainer", "/trainer/:path*"],
};
