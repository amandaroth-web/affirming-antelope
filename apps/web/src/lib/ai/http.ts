import { createHash, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { aiMode } from "./client";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Maps anything thrown while handling a request to a safe {status, message}. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Anthropic.APIUserAbortError) return new ApiError(499, "Request cancelled.");
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new ApiError(504, "The AI took too long to respond. Please try again.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ApiError(502, "Could not reach the AI service. Please try again.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ApiError(503, "The AI service is busy right now. Please try again in a moment.", { "Retry-After": "10" });
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("[ai] Anthropic auth failure (check ANTHROPIC_API_KEY).");
    return new ApiError(502, "The AI service is misconfigured.");
  }
  if (err instanceof Anthropic.APIError) {
    // Log status + message server-side only; never forward upstream bodies.
    console.error(`[ai] Anthropic API error ${err.status ?? "?"}: ${err.message}`);
    return new ApiError(502, "The AI service returned an error. Please try again.");
  }
  console.error("[ai] Unexpected error:", err instanceof Error ? err.message : "unknown");
  return new ApiError(500, "Something went wrong.");
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-antelope-key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (!origin) return base; // native app: no CORS involved

  if (process.env.NODE_ENV !== "production") {
    // Dev: Expo web (localhost:8081), LAN IPs, tunnels. Reflect whatever asks.
    return { ...base, "Access-Control-Allow-Origin": origin };
  }
  const allowed = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return allowed.includes(origin) ? { ...base, "Access-Control-Allow-Origin": origin } : base;
}

export function optionsResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function jsonResponse(req: Request, body: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(req),
      ...extra,
    },
  });
}

export function errorResponse(req: Request, err: unknown): Response {
  const e = toApiError(err);
  return jsonResponse(req, { error: e.message }, e.status, e.headers);
}

export function streamResponse(req: Request, body: ReadableStream<Uint8Array>): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      ...corsHeaders(req),
    },
  });
}

// ---------------------------------------------------------------------------
// Abuse guards
// ---------------------------------------------------------------------------

/**
 * Shared app token gate for guests. When APP_CLIENT_TOKEN is set, requests must
 * carry a matching `x-antelope-key` header (constant-time compare) or get 401.
 * When it is unset (local dev) the check is skipped. OPTIONS preflight never calls
 * this. Signed-in callers skip it: see `authorize()` in ./auth.ts.
 *
 * The token ships inside the app binary, so it only deters casual abuse.
 */
export function requireClientKey(req: Request): void {
  const expected = process.env.APP_CLIENT_TOKEN;
  if (!expected) return;
  const given = req.headers.get("x-antelope-key") ?? "";
  // Hash both sides so lengths match and timingSafeEqual never throws.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) throw new ApiError(401, "unauthorized");
}

// In-memory sliding-window rate limit per IP. Best effort only: on serverless
// the state is per instance (not shared across instances, reset on cold start
// and deploy), and IPs come from spoofable headers unless a trusted proxy sets
// them. Swap for Redis/Upstash before real launch.

const hits = new Map<string, number[]>();
let lastSweep = 0;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

/** Per-IP limit (guests). */
export function rateLimit(req: Request, bucket: string, max: number, windowMs = 60_000): void {
  rateLimitKey(`${bucket}:ip:${clientIp(req)}`, max, windowMs);
}

/** Limit on an arbitrary key, e.g. `${bucket}:user:${userId}` for signed-in callers. */
export function rateLimitKey(key: string, max: number, windowMs = 60_000): void {
  const now = Date.now();
  if (now - lastSweep > windowMs * 5) {
    lastSweep = now;
    for (const [k, v] of hits) if (v.every((t) => now - t > 10 * 60_000)) hits.delete(k);
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    const retry = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    hits.set(key, recent);
    throw new ApiError(429, "Too many requests. Please slow down and try again shortly.", {
      "Retry-After": String(retry),
    });
  }
  recent.push(now);
  hits.set(key, recent);
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 128 * 1024;

export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) throw new ApiError(413, "Request body is too large.");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "Request body is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

/** Throws 503 when production has no key; returns the mode otherwise. */
export function requireAi(): "live" | "mock" {
  const mode = aiMode();
  if (mode === "unavailable") throw new ApiError(503, "The AI service is not configured.");
  return mode;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}
