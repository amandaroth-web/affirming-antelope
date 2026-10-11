import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import type { AiEndpoint } from '@antelope/core';
import { track } from './analytics';
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

/** Which AI endpoint a path is, for `ai_request_failed`. Other paths aren't AI calls. */
function aiEndpoint(path: string): AiEndpoint | null {
  if (path.startsWith('/api/drill')) return 'drill';
  if (path.startsWith('/api/roleplay/turn')) return 'turn';
  if (path.startsWith('/api/roleplay/debrief')) return 'debrief';
  return null;
}

/** Status code only (0 = never got a response). Never the request, the response body or the error text. */
function reportFailure(path: string, status: number) {
  const endpoint = aiEndpoint(path);
  if (endpoint) track('ai_request_failed', { endpoint, status });
}

/** A request that threw before any response (offline, DNS, timeout). Caller-initiated aborts aren't failures. */
function reportThrown(path: string, e: unknown) {
  if ((e as { name?: string } | null)?.name === 'AbortError') return;
  reportFailure(path, 0);
}

async function failure(res: { status: number; text(): Promise<string> }, path?: string): Promise<ApiError> {
  if (path) reportFailure(path, res.status);
  const text = await res.text().catch(() => '');
  return new ApiError(res.status, text || `Request failed with status ${res.status}`);
}

export async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    reportThrown(path, e);
    throw e;
  }
  if (!res.ok) throw await failure(res, path);
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
  let res: Response;
  try {
    res = await doFetch(apiUrl(path), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    reportThrown(path, e);
    throw e;
  }
  if (!res.ok) throw await failure(res, path);

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
