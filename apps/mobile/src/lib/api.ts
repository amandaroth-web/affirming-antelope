import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { currentSession } from './supabase';

const DEV_API_PORT = 3000;

/**
 * Base URL of the Next.js API (apps/web).
 *
 * 1. `EXPO_PUBLIC_API_URL` if set (use this for deployed builds).
 * 2. Otherwise the dev machine's LAN host, taken from the Expo dev server's
 *    `hostUri` (e.g. "192.168.1.5:8081"), on port 3000. This is what makes a
 *    phone running Expo Go reach `next dev` on the laptop.
 * 3. Otherwise http://localhost:3000.
 */
function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${DEV_API_PORT}`;

  return `http://localhost:${DEV_API_PORT}`;
}

/**
 * Headers sent on every API call.
 * - Signed in: `Authorization: Bearer <Supabase access token>` (verified server-side,
 *   per-user rate limit). supabase-js keeps the token fresh while the app is open.
 * - Always, when set: `x-antelope-key`, the shared guest app token
 *   (`EXPO_PUBLIC_APP_TOKEN`). It ships inside the binary, so it only deters casual
 *   abuse; guests rely on it, and it's a fallback if a bearer token is rejected.
 */
function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = process.env.EXPO_PUBLIC_APP_TOKEN;
  if (token) headers['x-antelope-key'] = token;
  const access = currentSession()?.access_token;
  if (access) headers.Authorization = `Bearer ${access}`;
  return headers;
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function failure(res: { status: number; text(): Promise<string> }): Promise<ApiError> {
  const text = await res.text().catch(() => '');
  return new ApiError(res.status, text || `Request failed with status ${res.status}`);
}

export async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

/**
 * POST and stream the text response, calling `onChunk` with each decoded
 * piece as it arrives. Resolves with the full text.
 *
 * Streaming notes: React Native's built-in `fetch` does not expose
 * `response.body` as a ReadableStream. This uses `expo/fetch` (WinterCG fetch
 * with streaming, available in Expo Go on SDK 52+) on native, and the browser
 * `fetch` on web. If a stream still isn't available, it falls back to reading
 * the whole body and calls `onChunk` once with the full text.
 */
export async function postStream(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const doFetch = (expoFetch as unknown as typeof fetch) ?? fetch;
  const res = await doFetch(apiUrl(path), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await failure(res);

  const reader = res.body?.getReader?.();
  if (!reader) {
    const text = await res.text();
    if (text) onChunk(text);
    return text;
  }

  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    if (piece) {
      full += piece;
      onChunk(piece);
    }
  }
  const rest = decoder.decode();
  if (rest) {
    full += rest;
    onChunk(rest);
  }
  return full;
}
