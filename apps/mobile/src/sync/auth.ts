import { currentSession, errorCode, isTransient, supabase } from '@/lib/supabase';
import { useAccount } from '@/state/account';

/**
 * Email one-time code sign-in, for a learner who is a guest (an anonymous Supabase
 * user, docs/anonymous-auth.md) or has no session at all:
 *
 *   convert   a guest with a new email: `updateUser({ email })` sends a code and
 *             `verifyOtp({ type: 'email_change' })` makes the same user permanent.
 *             The uid doesn't change, so their practice is already where it belongs.
 *   existing  a guest whose email already has an account: sign in to it with a code.
 *             The guest's token is kept first (`pendingMerge`) so the sync engine can
 *             ask the API to move the guest's practice into that account.
 *   new       no session (offline first launch, older installs): plain email OTP,
 *             creating the account if needed. The engine uploads local practice.
 *
 * The auth listener in `engine.ts` takes it from there.
 */

export type AuthFailure = 'offline' | 'rate-limited' | 'invalid' | 'expired' | 'error';
type Mode = 'convert' | 'existing' | 'new';

function classify(e: unknown): AuthFailure {
  const err = e as { status?: number; code?: string; message?: string };
  if (isTransient(e) && err.status !== 429) return 'offline';
  if (err.status === 429 || /rate limit|too many/i.test(err.message ?? '') || errorCode(e) === 'over_email_send_rate_limit') return 'rate-limited';
  if (errorCode(e) === 'otp_expired' || /expired/i.test(err.message ?? '')) return 'expired';
  if (err.status === 400 || err.status === 403 || /invalid|token/i.test(err.message ?? '')) return 'invalid';
  return 'error';
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Which kind of code went to which address (the verify step needs the matching type). */
let pending: { email: string; mode: Mode } | null = null;

const norm = (email: string) => email.trim().toLowerCase();

async function guestSession() {
  const s = currentSession() ?? (await supabase.auth.getSession()).data.session;
  return s?.user.is_anonymous ? s : null;
}

/**
 * Keep the guest's access token for merge-anonymous. It must still be valid when the
 * merge runs, so refresh it if it's within ten minutes of expiring.
 */
async function keepGuestToken() {
  let s = await guestSession();
  if (!s) return;
  if ((s.expires_at ?? 0) * 1000 - Date.now() < 10 * 60_000) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session?.user.is_anonymous) s = data.session;
  }
  useAccount.getState().set({ pendingMerge: { anonId: s.user.id, token: s.access_token } });
}

export async function sendCode(email: string): Promise<{ ok: true } | { ok: false; reason: AuthFailure }> {
  const e = norm(email);
  try {
    const guest = await guestSession();
    if (guest) {
      const { error } = await supabase.auth.updateUser({ email: e });
      if (!error) {
        pending = { email: e, mode: 'convert' };
        return { ok: true };
      }
      if (errorCode(error) !== 'email_exists') return { ok: false, reason: classify(error) };
      // this email already has an account: sign in to it, and bring the guest's practice along
      await keepGuestToken();
      const { error: e2 } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: false } });
      if (e2) return { ok: false, reason: classify(e2) };
      pending = { email: e, mode: 'existing' };
      return { ok: true };
    }
    const { error } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    if (error) return { ok: false, reason: classify(error) };
    pending = { email: e, mode: 'new' };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: classify(err) };
  }
}

export async function verifyCode(email: string, token: string): Promise<{ ok: true; userId: string } | { ok: false; reason: AuthFailure }> {
  const e = norm(email);
  const mode: Mode = pending?.email === e ? pending.mode : 'new';
  try {
    const { data, error } = await supabase.auth.verifyOtp({ email: e, token, type: mode === 'convert' ? 'email_change' : 'email' });
    if (error || !data.user) return { ok: false, reason: classify(error) };
    pending = null;
    return { ok: true, userId: data.user.id };
  } catch (err) {
    return { ok: false, reason: classify(err) };
  }
}

/**
 * Sign out of the account on this device. Local practice stays, and the engine starts
 * a fresh guest (a new anonymous user) once the old session is gone.
 */
export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
