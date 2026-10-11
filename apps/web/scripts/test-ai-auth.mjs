// Route-level tests for the AI API auth, quotas and merge-anonymous. LOCAL ONLY: it
// signs up users, edits quota rows directly and moves the global ceiling.
//
// 1. A local Supabase stack with the migrations applied (`npm run db:reset`).
// 2. The web app in mock mode with the secret key and a legacy token, e.g.
//      AI_MOCK=1 APP_CLIENT_TOKEN=test-legacy-token ALLOW_LEGACY_APP_TOKEN=1 \
//      SUPABASE_SECRET_KEY=<secret key from `supabase status`> npm run dev -w web
// 3. node apps/web/scripts/test-ai-auth.mjs [main | legacy-off | no-secret]
//      legacy-off: restart the app with ALLOW_LEGACY_APP_TOKEN=0
//      no-secret:  restart the app without SUPABASE_SECRET_KEY
//
// Env (defaults in brackets): API_URL [http://127.0.0.1:3000], SUPABASE_WORKDIR [repo root],
// DB_CONTAINER [supabase_db_affirming-antelope], LEGACY_TOKEN [test-legacy-token].
// URLs and keys come from `supabase status`.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const statusArgs = ["status", "-o", "json", ...(process.env.SUPABASE_WORKDIR ? ["--workdir", process.env.SUPABASE_WORKDIR] : [])];
const status = JSON.parse(execFileSync("supabase", statusArgs, { stdio: ["ignore", "pipe", "ignore"] }).toString());
const URL_ = status.API_URL;
const PUB = status.PUBLISHABLE_KEY;
const SECRET = status.SECRET_KEY;
const MAILPIT = status.MAILPIT_URL ?? status.INBUCKET_URL;
const API = process.env.API_URL ?? "http://127.0.0.1:3000";
const DB_CONTAINER = process.env.DB_CONTAINER ?? "supabase_db_affirming-antelope";
const LEGACY = process.env.LEGACY_TOKEN ?? "test-legacy-token";
const phase = process.argv[2] ?? "main";
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) throw new Error("Refusing to run against a non-local Supabase.");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`ok   ${name}`); }
  else { fail++; console.log(`FAIL ${name}`, extra === undefined ? "" : JSON.stringify(extra).slice(0, 400)); }
}
const sql = (q) => execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-qtAX", "-c", q]).toString().trim();
const client = () => createClient(URL_, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

async function call(path, { token, key, body, method = "POST", headers = {} } = {}) {
  const h = { "Content-Type": "application/json", ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (key) h["x-antelope-key"] = key;
  const res = await fetch(API + path, { method, headers: h, body: method === "POST" ? JSON.stringify(body ?? {}) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, json, text };
}
const drill = (o) => call("/api/drill/feedback", { ...o, body: { drillId: "drill-oars-01", response: "It sounds like you're worried about the deadline." } });
const debrief = (o) => call("/api/roleplay/debrief", { ...o, body: {
  scenarioId: "PM-017",
  turns: [{ id: "t1", speaker: "employee", text: "I'm swamped." }, { id: "t2", speaker: "learner", text: "You're carrying a lot right now." }],
  selfReflection: { feeling: "mixed", text: "" } } });
const turn = (o) => call("/api/roleplay/turn", { ...o, body: { scenarioId: "PM-017", turns: [{ id: "t1", speaker: "learner", text: "How are things going?" }] } });

async function anonSession() {
  const c = client();
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw error;
  return { c, token: data.session.access_token, id: data.user.id };
}
async function permanentSession(email) {
  const password = "pw-" + Math.random().toString(36).slice(2) + "A1!";
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = client();
  const { data, error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { c, token: data.session.access_token, id: created.user.id };
}
async function latestOtp(email) {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + email)}`)).json();
    const m = list.messages?.[0];
    if (m) {
      const subj = m.Subject ?? "";
      const code = /(\d{6})/.exec(subj)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("no OTP mail for " + email);
}

if (phase === "main") {
  // ------------------------------------------------------------ auth required
  let r = await drill({});
  check("no credentials -> 401 auth_required", r.status === 401 && r.json?.code === "auth_required", r.json);
  r = await drill({ token: "not-a-jwt" });
  check("garbage bearer -> 401 invalid_token", r.status === 401 && r.json?.code === "invalid_token", r.json);

  // ------------------------------------------------------------ CORS preflight
  const pre = await fetch(API + "/api/roleplay/turn", { method: "OPTIONS", headers: { Origin: "http://localhost:8081", "Access-Control-Request-Method": "POST" } });
  check("OPTIONS preflight 204 with CORS", pre.status === 204 && pre.headers.get("access-control-allow-origin") === "http://localhost:8081"
    && /Authorization/.test(pre.headers.get("access-control-allow-headers") ?? ""));

  // ------------------------------------------------------------ anonymous token accepted
  const a = await anonSession();
  r = await drill({ token: a.token });
  check("anonymous token accepted (drill 200, mock)", r.status === 200 && r.json && !r.json.error, r.json);
  check("anonymous drill quota header 40/39", r.headers.get("x-quota-limit") === "40" && r.headers.get("x-quota-remaining") === "39",
    [r.headers.get("x-quota-limit"), r.headers.get("x-quota-remaining")]);
  r = await turn({ token: a.token, headers: { Origin: "http://localhost:8081" } });
  check("anonymous turn streams 200 with CORS", r.status === 200 && r.text.length > 0 && r.headers.get("access-control-allow-origin") === "http://localhost:8081", r.status);
  check("CORS exposes quota headers", /X-Quota-Remaining/.test(r.headers.get("access-control-expose-headers") ?? ""));
  r = await call("/api/drill/feedback", { token: a.token, body: { drillId: "nope", response: "x" } });
  check("invalid request is not charged (404, no quota header)", r.status === 404, r.json);
  check("server counter matches", sql(`select count from app_private.ai_usage where user_id = '${a.id}' and bucket = 'drill'`) === "1");

  // ------------------------------------------------------------ quotas decrement then 429
  const d1 = await debrief({ token: a.token });
  const d2 = await debrief({ token: a.token });
  const d3 = await debrief({ token: a.token });
  check("debrief 1,2 allowed (remaining 5,4)", d1.status === 200 && d2.status === 200
    && d1.headers.get("x-quota-remaining") === "5" && d2.headers.get("x-quota-remaining") === "4",
    [d1.status, d2.status, d1.headers.get("x-quota-remaining"), d2.headers.get("x-quota-remaining")]);
  check("3rd debrief in a minute -> 429 burst with retry_after", d3.status === 429 && d3.json?.code === "quota_exceeded"
    && d3.json?.reason === "burst" && d3.json?.retry_after >= 1 && d3.json?.retry_after <= 60
    && d3.headers.get("retry-after") === String(d3.json?.retry_after), d3.json);
  sql(`update app_private.ai_usage set count = 6, minute_count = 0, minute_start = null where user_id = '${a.id}' and bucket = 'debrief'`);
  r = await debrief({ token: a.token });
  check("over the daily anonymous debrief limit -> 429 daily", r.status === 429 && r.json?.reason === "daily" && r.json?.remaining === 0
    && /Sign in with your email/.test(r.json?.error ?? "") && r.json?.retry_after > 60, r.json);

  // ------------------------------------------------------------ RLS end-to-end for the anonymous user
  let { error } = await a.c.rpc("join_cohort", { code: "MIL-DEMO" });
  check("anonymous join_cohort via PostgREST -> 42501 account_required", error?.code === "42501" && error?.hint === "account_required", error);
  ({ error } = await a.c.from("learner_state").insert({ user_id: a.id, state: { firstName: "Guest", currentWeek: 4, completedActivityIds: ["x1"] }, version: 1 }));
  check("anonymous writes own learner_state", !error, error);
  ({ error } = await a.c.from("activity_completions").insert({ client_id: crypto.randomUUID(), kind: "drill", ref_id: "drill-oars-01" }));
  check("anonymous writes own completion", !error, error);
  ({ error } = await a.c.from("practice_sessions").insert({ client_id: crypto.randomUUID(), kind: "drill", ref_id: "drill-oars-01" }));
  check("anonymous writes own session", !error, error);

  // ------------------------------------------------------------ permanent limits + circuit breaker
  const p = await permanentSession(`perm-${Date.now()}@example.com`);
  r = await drill({ token: p.token });
  check("permanent drill limit 200", r.status === 200 && r.headers.get("x-quota-limit") === "200" && r.headers.get("x-quota-remaining") === "199",
    [r.status, r.headers.get("x-quota-limit")]);
  r = await debrief({ token: p.token });
  check("permanent debrief limit 30", r.status === 200 && r.headers.get("x-quota-limit") === "30", r.status);
  sql(`update app_private.ai_global_limits g set per_day = u.count from app_private.ai_usage_global u where g.bucket = 'debrief' and u.bucket = 'debrief' and u.day = (now() at time zone 'utc')::date`);
  sql(`update app_private.ai_usage set minute_count = 0, minute_start = null where user_id = '${p.id}'`);
  r = await debrief({ token: p.token });
  check("global debrief ceiling -> 503 ai_resting", r.status === 503 && r.json?.code === "ai_resting" && /resting/.test(r.json?.error ?? "")
    && Number(r.headers.get("retry-after")) > 0, r.json);
  r = await drill({ token: p.token });
  check("breaker is per bucket (drill still 200)", r.status === 200, r.status);
  sql(`update app_private.ai_global_limits set per_day = 1000 where bucket = 'debrief'`);
  r = await debrief({ token: p.token });
  check("ceiling restored -> debrief 200", r.status === 200, r.json);

  // ------------------------------------------------------------ merge-anonymous
  r = await call("/api/account/merge-anonymous", { token: a.token, body: { anonymousAccessToken: a.token } });
  check("merge with the same token -> 400 same_user", r.status === 400 && r.json?.code === "same_user", r.json);
  const a2 = await anonSession();
  r = await call("/api/account/merge-anonymous", { token: a2.token, body: { anonymousAccessToken: a.token } });
  check("merge with an anonymous bearer -> 403 account_required", r.status === 403 && r.json?.code === "account_required", r.json);
  r = await call("/api/account/merge-anonymous", { token: p.token, body: {} });
  check("merge without anonymousAccessToken -> 400", r.status === 400 && r.json?.code === "anonymous_token_required", r.json);
  r = await call("/api/account/merge-anonymous", { token: p.token, body: { anonymousAccessToken: "garbage" } });
  check("merge with a bad anonymous token -> 401 invalid_anonymous_token", r.status === 401 && r.json?.code === "invalid_anonymous_token", r.json);
  const p2 = await permanentSession(`perm2-${Date.now()}@example.com`);
  r = await call("/api/account/merge-anonymous", { token: p.token, body: { anonymousAccessToken: p2.token } });
  check("merge with a permanent 'anonymous' token -> 409 not_anonymous", r.status === 409 && r.json?.code === "not_anonymous", r.json);

  // give the permanent account its own state so the merge has to merge
  ({ error } = await p.c.from("learner_state").insert({ user_id: p.id, state: { firstName: "Pat", currentWeek: 2, completedActivityIds: ["p1"] }, version: 3 }));
  check("permanent writes own learner_state", !error, error);
  const usageBefore = Number(sql(`select coalesce(sum(count),0) from app_private.ai_usage where user_id = '${p.id}'`));
  r = await call("/api/account/merge-anonymous", { token: p.token, body: { anonymousAccessToken: a.token } });
  check("merge-anonymous 200", r.status === 200 && r.json?.merged === true && r.json?.learnerState === "merged"
    && r.json?.completionsMoved === 1 && r.json?.sessionsMoved === 1 && r.json?.anonymousUserDeleted === true, r.json);
  const st = JSON.parse(sql(`select state from public.learner_state where user_id = '${p.id}'`));
  check("merged state: account name, max week, union of ids", st.firstName === "Pat" && st.currentWeek === 4
    && JSON.stringify(st.completedActivityIds) === '["p1","x1"]', st);
  check("version bumped to 4", sql(`select version from public.learner_state where user_id = '${p.id}'`) === "4");
  check("rows now belong to the account", sql(`select (select count(*) from activity_completions where user_id = '${p.id}') || ',' || (select count(*) from practice_sessions where user_id = '${p.id}')`) === "1,1");
  check("anonymous auth user deleted", sql(`select count(*) from auth.users where id = '${a.id}'`) === "0");
  check("anonymous rows gone", sql(`select (select count(*) from learner_state where user_id = '${a.id}') + (select count(*) from activity_completions where user_id = '${a.id}') + (select count(*) from practice_sessions where user_id = '${a.id}')`) === "0");
  const usageAfter = Number(sql(`select coalesce(sum(count),0) from app_private.ai_usage where user_id = '${p.id}'`));
  check("guest AI usage carried over to the account", usageAfter > usageBefore, [usageBefore, usageAfter]);
  r = await call("/api/account/merge-anonymous", { token: p.token, body: { anonymousAccessToken: a.token } });
  check("merging again (guest deleted) -> 401 invalid_anonymous_token", r.status === 401 && r.json?.code === "invalid_anonymous_token", r.json);
  r = await drill({ token: a.token });
  check("deleted guest's token no longer gets AI", r.status === 401, [r.status, r.json]);

  // ------------------------------------------------------------ conversion keeps the uid
  const c3 = await anonSession();
  const email = `convert-${Date.now()}@example.com`;
  ({ error } = await c3.c.auth.updateUser({ email }));
  check("updateUser({ email }) on an anonymous user", !error, error);
  const code = await latestOtp(email);
  const v = await c3.c.auth.verifyOtp({ email, token: code, type: "email_change" });
  check("verifyOtp type email_change converts", !v.error && v.data.user?.id === c3.id && v.data.user?.is_anonymous === false, v.error ?? v.data.user);
  const convertedToken = v.data.session?.access_token;
  ({ error } = await c3.c.rpc("join_cohort", { code: "MIL-DEMO" }));
  check("converted user (same uid) joins a cohort", !error, error);
  r = await drill({ token: convertedToken });
  check("converted user gets permanent limits", r.status === 200 && r.headers.get("x-quota-limit") === "200", r.headers.get("x-quota-limit"));

  // ------------------------------------------------------------ existing account: signInWithOtp
  const e2 = `existing-${Date.now()}@example.com`;
  const ex = await permanentSession(e2);
  const g = await anonSession();
  const guestToken = g.token; // captured before switching
  ({ error } = await g.c.auth.updateUser({ email: e2 }));
  check("updateUser to a taken email errors (client then offers sign-in)", !!error, error?.code ?? error?.message);
  ({ error } = await g.c.auth.signInWithOtp({ email: e2, options: { shouldCreateUser: false } }));
  check("signInWithOtp to the existing account", !error, error);
  const code2 = await latestOtp(e2);
  const v2 = await g.c.auth.verifyOtp({ email: e2, token: code2, type: "email" });
  check("verifyOtp type email signs in to the existing account", !v2.error && v2.data.user?.id === ex.id, v2.error);
  r = await call("/api/account/merge-anonymous", { token: v2.data.session.access_token, body: { anonymousAccessToken: guestToken } });
  check("merge after switching accounts -> 200", r.status === 200 && r.json?.merged === true, r.json);

  // ------------------------------------------------------------ brand-new email sign-in still works with confirmations on
  const e3 = `newbie-${Date.now()}@example.com`;
  const nc = client();
  ({ error } = await nc.auth.signInWithOtp({ email: e3 }));
  check("signInWithOtp for a new email", !error, error);
  const code3 = await latestOtp(e3);
  const v3 = await nc.auth.verifyOtp({ email: e3, token: code3, type: "email" });
  check("verifyOtp type email signs up the new user", !v3.error && v3.data.user?.is_anonymous === false, v3.error);

  // ------------------------------------------------------------ attaching an email requires the code
  const c4 = await anonSession();
  const e4 = `pending-${Date.now()}@example.com`;
  await c4.c.auth.updateUser({ email: e4 });
  check("updateUser({ email }) alone does not convert", sql(`select is_anonymous from auth.users where id = '${c4.id}'`) === "t");

  // ------------------------------------------------------------ legacy token with the flag on
  r = await drill({ key: LEGACY });
  check("legacy token accepted with ALLOW_LEGACY_APP_TOKEN=1 (per-IP limit 15)", r.status === 200 && r.headers.get("x-quota-limit") === "15", [r.status, r.json]);
  r = await drill({ key: "wrong" });
  check("wrong legacy token -> 401", r.status === 401 && r.json?.code === "invalid_app_token", r.json);
  const l1 = await debrief({ key: LEGACY });
  const l2 = await debrief({ key: LEGACY });
  check("legacy per-IP burst guard (debrief 1/min)", l1.status === 200 && l2.status === 429 && l2.json?.reason === "burst", [l1.status, l2.json]);
  check("legacy usage stored as an IP hash", /^[0-9a-f]{64}$/.test(sql(`select ip_hash from app_private.ai_usage_legacy_ip limit 1`)));
}

if (phase === "legacy-off") {
  let r = await drill({ key: LEGACY });
  check("legacy token refused with ALLOW_LEGACY_APP_TOKEN=0", r.status === 401 && r.json?.code === "auth_required", r.json);
  const a = await anonSession();
  r = await drill({ token: a.token });
  check("anonymous token still accepted", r.status === 200, r.status);
}

if (phase === "no-secret") {
  const p = await permanentSession(`nosecret-${Date.now()}@example.com`);
  const a = await anonSession();
  let r = await call("/api/account/merge-anonymous", { token: p.token, body: { anonymousAccessToken: a.token } });
  check("merge without the secret key -> 503 merge_unavailable", r.status === 503 && r.json?.code === "merge_unavailable", r.json);
  r = await drill({ key: LEGACY });
  check("legacy without the secret key -> 503 (fails closed)", r.status === 503 && r.json?.code === "quota_unavailable", r.json);
  r = await drill({ token: a.token });
  check("anonymous users don't need the secret key", r.status === 200, r.status);
}

console.log(`\n${phase}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
