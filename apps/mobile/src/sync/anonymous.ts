import type { Session } from '@supabase/supabase-js';
import { currentSession, setCurrentSession, supabase, supabaseConfigured } from '@/lib/supabase';

/**
 * Guests are Supabase anonymous users (docs/anonymous-auth.md). Every install gets one
 * quietly on first launch, so practice syncs and the AI API has a token from the start.
 *
 * Offline is normal: if the sign-in fails, the app keeps working locally and this
 * tries again (backoff, foreground, reconnect, and right before an AI request). The
 * auth listener in `engine.ts` takes over once the session exists, and uploads
 * whatever was practiced before it did.
 */

let creating: Promise<Session | null> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

const backoffMs = (n: number) => Math.min(10 * 60_000, 15_000 * 2 ** Math.min(n, 6));

/** The current session, creating an anonymous one if there is none. Null when offline / unconfigured. */
export function ensureSession(): Promise<Session | null> {
  const s = currentSession();
  if (s) return Promise.resolve(s);
  if (!supabaseConfigured) return Promise.resolve(null);
  if (creating) return creating;
  creating = (async () => {
    try {
      // a stored session the listener hasn't reported yet
      const stored = (await supabase.auth.getSession()).data.session;
      if (stored) {
        setCurrentSession(stored);
        return stored;
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.session) throw error ?? new Error('no session');
      failures = 0;
      // Record it now, not when the auth listener fires: `creating` clears below, and a
      // call landing in between would otherwise create a second anonymous user.
      setCurrentSession(data.session);
      return data.session;
    } catch {
      failures += 1;
      scheduleRetry();
      return null;
    }
  })().finally(() => {
    creating = null;
  });
  return creating;
}

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (!currentSession()) void ensureSession();
  }, backoffMs(failures));
}

/** Foreground / reconnect: try now instead of waiting for the backoff. */
export function retryAnonymousNow() {
  if (currentSession() || !supabaseConfigured) return;
  failures = 0;
  void ensureSession();
}

/** Like `ensureSession`, but gives up after `ms` so a request never hangs on it. */
export function sessionWithin(ms: number): Promise<Session | null> {
  return Promise.race([ensureSession(), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}
