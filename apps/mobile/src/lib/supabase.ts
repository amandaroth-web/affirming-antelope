import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@antelope/core';
import { createClient, type Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

const DEV_SUPABASE_PORT = 54321;
/** `supabase start`'s public local default. Safe to ship in dev builds only. */
const LOCAL_PUBLISHABLE_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

/**
 * Supabase API URL.
 *
 * 1. `EXPO_PUBLIC_SUPABASE_URL` if set (hosted project, deployed builds).
 * 2. In dev, the dev machine's LAN host from the Expo dev server's `hostUri`
 *    (e.g. "192.168.1.5:8081") on port 54321, so a phone reaches `supabase start`
 *    on the laptop. Same derivation as `lib/api.ts`.
 * 3. In dev, http://127.0.0.1:54321 (simulator, web).
 * Release builds without the env var have no backend: the app stays in guest mode.
 */
function supabaseUrl(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (!__DEV__) return null;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || '127.0.0.1'}:${DEV_SUPABASE_PORT}`;
}

function publishableKey(): string | null {
  return process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || (__DEV__ ? LOCAL_PUBLISHABLE_KEY : null);
}

const URL_ = supabaseUrl();
const KEY = publishableKey();

/** False when this build has no backend configured; sign-in UI hides itself. */
export const supabaseConfigured = !!(URL_ && KEY);
export const SUPABASE_URL = URL_ ?? '';

/** A dev build talking to `supabase start` (localhost, a LAN IP, or a .local host), never a hosted project. */
export const isLocalSupabase =
  __DEV__ && Platform.OS !== 'web' && /^http:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^/]+\.local)[^/]*:54321$/.test(SUPABASE_URL);

// ---------------------------------------------------------------------------
// Dev: simulate being offline (Me › Demo › Simulate offline). Every Supabase
// request fails like a dropped connection, so the outbox can be exercised on
// the simulator, which shares the Mac's network.
// ---------------------------------------------------------------------------
let simulatedOffline = false;
const offlineListeners = new Set<(on: boolean) => void>();
export function setSimulatedOffline(on: boolean) {
  simulatedOffline = on;
  offlineListeners.forEach((l) => l(on));
}
export function isSimulatedOffline() {
  return simulatedOffline;
}
export function onSimulatedOfflineChange(l: (on: boolean) => void) {
  offlineListeners.add(l);
  return () => offlineListeners.delete(l);
}

const guardedFetch: typeof fetch = (input, init) => {
  if (simulatedOffline) return Promise.reject(new TypeError('Network request failed'));
  return fetch(input, init);
};

export const supabase = createClient<Database>(URL_ ?? 'http://127.0.0.1:1', KEY ?? 'unconfigured', {
  auth: {
    storage: AsyncStorage,
    storageKey: 'antelope.auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: { fetch: guardedFetch },
});

// Refresh tokens only while the app is in the foreground (Supabase's React Native
// guidance): a backgrounded app can't keep its timers alive, so it refreshes on return.
if (Platform.OS !== 'web' && supabaseConfigured) {
  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// The latest session, kept in step by the auth listener, so synchronous callers
// (API headers) can read the access token without awaiting storage.
let current: Session | null = null;
export function currentSession(): Session | null {
  return current;
}
export function setCurrentSession(s: Session | null) {
  current = s;
}

/** PostgREST / Postgres error code, e.g. 'PT409', '23505', '42501'. */
export function errorCode(e: unknown): string | undefined {
  return (e as { code?: string } | null)?.code ?? undefined;
}

/**
 * True when a failure is about the connection (or the server being down), so the
 * operation should be retried later rather than dropped.
 */
export function isTransient(e: unknown): boolean {
  if (!e) return false;
  const err = e as {
    name?: string;
    message?: string;
    code?: string;
    status?: number;
  };
  if (err.name === 'TypeError' || err.name === 'AbortError' || err.name === 'AuthRetryableFetchError') return true;
  const msg = `${err.message ?? ''}`;
  if (/network request failed|failed to fetch|load failed|fetch failed|timed out/i.test(msg)) return true;
  if (typeof err.status === 'number' && (err.status === 0 || err.status >= 500 || err.status === 401 || err.status === 429)) return true;
  // supabase-js wraps fetch failures as { message: 'TypeError: Network request failed', code: '' }
  if (err.code === '' || err.code === undefined) return /TypeError/.test(msg);
  // JWT expired / not yet refreshed
  if (err.code === 'PGRST301' || err.code === 'PGRST303') return true;
  return false;
}
