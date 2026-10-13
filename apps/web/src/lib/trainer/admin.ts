import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "./dal";

/**
 * Admins are the verified Supabase users whose email is in ADMIN_EMAILS (server env,
 * comma-separated, case-insensitive). There's no admin flag in the database: admin
 * pages and actions read and write with the secret key (getAdminClient), after
 * requireAdmin() has checked the caller on that same request.
 */

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True for a permanent user with a confirmed email listed in ADMIN_EMAILS. */
export function isAdmin(user: Pick<User, "email" | "email_confirmed_at" | "is_anonymous"> | null | undefined): boolean {
  if (!user || user.is_anonymous) return false;
  const email = user.email?.trim().toLowerCase();
  if (!email || !user.email_confirmed_at) return false;
  return adminEmails().has(email);
}

export interface AdminViewer {
  id: string;
  email: string;
}

/**
 * The signed-in admin, or null. Uses auth.getUser(), which asks Supabase Auth about
 * the token (not just the JWT), so email and email_confirmed_at are current.
 * Memoized per request.
 */
export const getAdmin = cache(async (): Promise<AdminViewer | null> => {
  const emails = adminEmails();
  if (!emails.size) return null;
  // Cheap pre-check on the verified JWT, so non-admins don't cost an Auth round trip.
  const viewer = await getViewer();
  if (!viewer || viewer.isAnonymous || !viewer.email || !emails.has(viewer.email.toLowerCase())) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !isAdmin(data.user)) return null;
  return { id: data.user.id, email: data.user.email!.toLowerCase() };
});

/** Admin pages: everyone else gets a 404, so the page doesn't advertise itself. */
export async function requireAdmin(): Promise<AdminViewer> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}
