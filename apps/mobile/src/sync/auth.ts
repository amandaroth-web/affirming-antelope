import { errorCode, isTransient, supabase } from '@/lib/supabase';

/**
 * Email one-time code sign-in. `shouldCreateUser` makes the same two steps work for
 * new and returning learners. The auth listener in `engine.ts` takes it from there.
 */

export type AuthFailure = 'offline' | 'rate-limited' | 'invalid' | 'expired' | 'error';

function classify(e: unknown): AuthFailure {
  const err = e as { status?: number; code?: string; message?: string };
  if (isTransient(e) && err.status !== 429) return 'offline';
  if (err.status === 429 || /rate limit|too many/i.test(err.message ?? '') || errorCode(e) === 'over_email_send_rate_limit') return 'rate-limited';
  if (errorCode(e) === 'otp_expired' || /expired/i.test(err.message ?? '')) return 'expired';
  if (err.status === 400 || err.status === 403 || /invalid|token/i.test(err.message ?? '')) return 'invalid';
  return 'error';
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function sendCode(email: string): Promise<{ ok: true } | { ok: false; reason: AuthFailure }> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) return { ok: false, reason: classify(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: classify(e) };
  }
}

export async function verifyCode(email: string, token: string): Promise<{ ok: true; userId: string } | { ok: false; reason: AuthFailure }> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    });
    if (error || !data.user) return { ok: false, reason: classify(error) };
    return { ok: true, userId: data.user.id };
  } catch (e) {
    return { ok: false, reason: classify(e) };
  }
}

/** Back to guest on this device only. Local practice stays. */
export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
