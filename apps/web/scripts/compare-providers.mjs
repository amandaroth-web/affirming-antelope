// Side-by-side check of AI providers through the real routes. LOCAL ONLY, costs real tokens.
//
//   node apps/web/scripts/compare-providers.mjs [--configs anthropic,openai] [--json out.json] [--no-doc]
//
// For each config it starts `next dev` on port 3051 (override with PORT) with that
// config's env, in dev auth mode (no Supabase env, so callers are "dev" with the
// in-memory limits), runs the fixed cases below, scores them with deterministic
// checks, then stops the server. Keys come from apps/web/.env.local as usual.
// Token counts are read from the server's "[ai] usage" log lines (no content is logged).
// Writes docs/ai-provider-comparison.md, keeping anything between the
// <!-- keep:start --> and <!-- keep:end --> markers (the hand-written recommendation).
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "..");
const ROOT = join(WEB, "..", "..");
const PORT = Number(process.env.PORT ?? 3051);
const API = `http://127.0.0.1:${PORT}`;
const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};

// ---------------------------------------------------------------------------
// Configs and prices
// ---------------------------------------------------------------------------

const CONFIGS = {
  anthropic: { label: "Anthropic (current defaults)", env: { AI_PROVIDER: "anthropic" } },
  openai: { label: "OpenAI (new defaults)", env: { AI_PROVIDER: "openai" } },
  "openai-luna": {
    label: "OpenAI, Luna for every role",
    env: { AI_PROVIDER: "openai", AI_OPENAI_MODEL_OBSERVER: "gpt-6-luna", AI_OPENAI_MODEL_COACH: "gpt-6-luna" },
  },
  "openai-sol-roleplay": {
    label: "OpenAI, 6 Sol role-player",
    env: { AI_PROVIDER: "openai", AI_OPENAI_MODEL_ROLEPLAYER: "gpt-6-sol", AI_OPENAI_MODEL_ROLEPLAYER_EFFORT: "none" },
  },
  "anthropic-lite": {
    label: "Anthropic, cheaper models",
    env: {
      AI_PROVIDER: "anthropic",
      AI_ANTHROPIC_MODEL_ROLEPLAYER: "claude-haiku-5-5",
      AI_ANTHROPIC_MODEL_DRILL: "claude-haiku-5-5",
      AI_ANTHROPIC_MODEL_COACH: "claude-sonnet-5-5",
    },
  },
};

// USD per 1M tokens, standard tier, short context. Checked 2026-10-11:
// developers.openai.com/api/docs/pricing and platform.claude.com/docs/en/about-claude/pricing.
// Luna's cache-write rate isn't listed; 1.25x input is assumed (the GPT-5.6+ rule).
const PRICES = {
  "claude-opus-5-5": { input: 4, cached: 0.2, write: 5, output: 20 },
  "claude-sonnet-5-5": { input: 2, cached: 0.1, write: 2.5, output: 10 },
  "claude-haiku-5-5": { input: 0.1, cached: 0.01, write: 0.125, output: 0.5 },
  "gpt-6-astra": { input: 10, cached: 1, write: 12.5, output: 50 },
  "gpt-6.1-sol": { input: 2, cached: 0.1, write: 2.5, output: 10 },
  "gpt-6-sol": { input: 2, cached: 0.2, write: 2.5, output: 10 },
  "gpt-6-luna": { input: 0.1, cached: 0.01, write: 0.125, output: 0.5 },
};

function cost(u) {
  const p = PRICES[u.model];
  if (!p) return NaN;
  return (u.in * p.input + u.cached * p.cached + u.cacheWrite * p.write + u.out * p.output) / 1e6;
}

// ---------------------------------------------------------------------------
// Fixed cases
// ---------------------------------------------------------------------------

const SCRIPTS = {
  "PM-017": {
    setting: "workplace",
    opening: "So I'm guessing this is about the reports.",
    reflect: [
      "It is. Before I say anything else, how have the last few months been for you?",
      "It sounds like something about the work changed for you, and the reports are just the part people can see.",
      "You've been the person finance counted on for years, and being seen as the holdup doesn't sit right with you.",
      "How you handle this is your call. What would make month-end feel workable again?",
    ],
    lecture: [
      "Yes. Three months late in a row isn't acceptable, and finance keeps coming to me about it.",
      "You need to start the reconciliation earlier. Have you tried blocking off the first two days of the month?",
      "I understand, but the data is final on the 3rd, so that isn't really an excuse.",
      "If this keeps happening we'll have to talk about a performance plan. I need you to commit to getting them in on time.",
    ],
    reflectSelf: { feeling: "solid", text: "I tried to reflect more than ask and not jump in with fixes." },
    lectureSelf: { feeling: "mixed", text: "I got the expectations across, but he got defensive." },
  },
  "CL-102": {
    setting: "clinical",
    opening: "Before you start, I know what the machine said. I feel fine. Honestly, I feel better than I did on that pill.",
    reflect: [
      "Feeling better off the pill matters to you. What was it like when you were taking it?",
      "So the pill was costing you something real, and feeling like yourself again isn't something you want to give up.",
      "You pay attention to your body and you look after the store and Carol. What do you want the next ten years to look like?",
      "It's your decision what you do about this. Part of you wants to stay off pills, and part of you wants to stay well for the people who count on you.",
    ],
    lecture: [
      "Feeling fine doesn't mean much with blood pressure. They call it the silent killer for a reason.",
      "You need to restart the lisinopril today and take it every morning.",
      "I understand, but a cough is a minor side effect compared to having a stroke.",
      "At 158 over 96 your stroke risk is a lot higher. You really have to take this seriously and drop the beet juice.",
    ],
    reflectSelf: { feeling: "solid", text: "I kept reflecting and didn't argue for the pill." },
    lectureSelf: { feeling: "mixed", text: "I made sure he heard the risks, but he dug in." },
  },
};
/** Scripted learner turn index (0-based) the observer must code a certain way. */
const DESIGNATED = {
  reflect: { index: 1, expect: ["complex-reflection"] },
  lecture: { index: 1, expect: ["advice-without-permission", "confront"] },
};

const PERSUADE = ["advice-without-permission", "confront"];
const DRILLS = [
  {
    id: "drill-oars-04",
    setting: "workplace",
    good: { text: "What has the commute been like for you since the construction started?", expect: ["open-question"] },
    weak: { text: "Have you tried taking the earlier train instead of driving?", expect: ["advice-without-permission"] },
  },
  {
    id: "drill-oars-05",
    setting: "workplace",
    good: { text: "You're forty minutes behind by noon most days.", expect: ["simple-reflection"] },
    weak: { text: "Are the complaints mostly from the afternoon patients?", expect: ["closed-question"] },
  },
  {
    id: "drill-evoking-05",
    setting: "workplace",
    good: {
      text: "On one hand it doesn't feel like a big deal to you, and at the same time you can see why I'm asking.",
      expect: ["complex-reflection"],
    },
    weak: { text: "I hear you, but it is a big deal, and it has to stop.", expect: ["confront"] },
  },
  {
    id: "drill-cl-oars-04",
    setting: "clinical",
    good: { text: "Your neighbor said the pills wrecked her muscles, and you read they can cause diabetes.", expect: ["simple-reflection"] },
    weak: { text: "You should keep taking the statin. Muscle pain is rare and the diabetes risk is tiny.", expect: PERSUADE },
  },
  {
    id: "drill-cl-evoking-04",
    setting: "clinical",
    good: { text: "What do you want the next few years with your grandkids to look like?", expect: ["open-question"] },
    weak: { text: "You need to do the rehab even if the drive is long. It lowers your risk of another heart attack.", expect: PERSUADE },
  },
  {
    id: "drill-cl-evoking-05",
    setting: "clinical",
    good: {
      text: "You've always been the healthy one and you hate the idea of pills, and since Jim's stroke you can't stop thinking about your own health.",
      expect: ["complex-reflection"],
    },
    weak: { text: "Have you talked with your family about your cholesterol?", expect: ["closed-question"] },
  },
];

// ---------------------------------------------------------------------------
// Deterministic checks
// ---------------------------------------------------------------------------

const META = /\b(as an ai|ai model|language model|simulation|role-?play|practice (tool|session|conversation)|motivational interviewing|reflections?|open questions?|change talk|scenario|my character|in character|instructions)\b/i;

function sentenceCount(text) {
  const t = text.replace(/\.{2,}|…/g, " ").replace(/\b(Mr|Mrs|Ms|Dr)\./g, "$1");
  return t.split(/[.!?]+(?=\s|$|["')])/).filter((s) => /[a-z0-9]/i.test(s)).length;
}

function rolePlayerChecks(text) {
  return {
    noMeta: !META.test(text),
    maxFourSentences: sentenceCount(text) <= 4,
    noAsterisks: !text.includes("*"),
    singleParagraph: !/\n\s*\n/.test(text.trim()),
    nonEmpty: text.trim().length > 0,
  };
}

const JUDGEMENT = /\b(in)?correct(ly)?\b(?! me)/i;
const WRONG_SETTING = {
  clinical: /\b(employees?|leaders?|managers?|direct reports?)\b/i,
  workplace: /\b(clinicians?|your patient)\b/i,
};

/** Coach/drill strings, optionally skipping some keys. Ids and enum codes are always skipped. */
function feedbackProse(obj, skip = ["possibleResponses"]) {
  const out = [];
  const walk = (v, key) => {
    if (skip.includes(key) || ["turnId", "speaker", "move", "suggestedNextStep"].includes(key)) return;
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(obj);
  return out.join("\n");
}

function feedbackChecks(obj, setting, fields) {
  const parsed = obj && typeof obj === "object" && fields.every((f) => f in obj);
  const prose = parsed ? feedbackProse(obj) : "";
  const all = parsed ? feedbackProse(obj, []) : "";
  return {
    parses: Boolean(parsed),
    noCorrectIncorrect: parsed && !JUDGEMENT.test(prose),
    settingWording: parsed && !WRONG_SETTING[setting].test(all),
  };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

function startServer(configEnv) {
  const env = { ...process.env, ...configEnv, PORT: String(PORT) };
  for (const k of ["AI_MOCK", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "AI_LOG_USAGE"]) {
    delete env[k];
  }
  const nextBin = join(ROOT, "node_modules", ".bin", "next");
  const child = spawn(nextBin, ["dev", "--port", String(PORT)], { cwd: WEB, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const lines = [];
  const onData = (buf) => {
    for (const line of buf.toString().split("\n")) if (line.trim()) lines.push(line);
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  return {
    lines,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          resolve();
        }
        setTimeout(() => {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {}
        }, 5000);
      }),
  };
}

let currentServer = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${API}/api/roleplay/turn`, { method: "OPTIONS" });
      if (r.status === 204) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("dev server did not start");
}

/** Compiles each route without an AI call (unknown ids 404 before any quota or model work). */
async function warmUp() {
  const t = [{ id: "w1", speaker: "learner", text: "hi" }];
  await post("/api/roleplay/turn", { scenarioId: "__warmup__", turns: t });
  await post("/api/roleplay/debrief", { scenarioId: "__warmup__", turns: t, selfReflection: { feeling: "mixed", text: "" } });
  await post("/api/drill/feedback", { drillId: "__warmup__", response: "hi" });
}

async function post(path, body, { stream = false } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const started = performance.now();
    const res = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 429 || res.status === 503) {
      const wait = Number(res.headers.get("retry-after") ?? 10);
      await res.text();
      const why = (currentServer?.lines ?? []).filter((l) => l.includes("[ai]") && !l.includes("[ai] usage")).slice(-2);
      console.log(`  ${res.status} on ${path}, waiting ${wait}s ${why.join(" | ")}`);
      await sleep(wait * 1000 + 500);
      continue;
    }
    if (!stream) {
      const text = await res.text();
      return { status: res.status, text, ms: performance.now() - started };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let ttfb = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (ttfb === null) ttfb = performance.now() - started;
      text += decoder.decode(value, { stream: true });
    }
    return { status: res.status, text, ms: performance.now() - started, ttfb: ttfb ?? performance.now() - started };
  }
  throw new Error(`${path}: still rate limited`);
}

const USAGE_RE = /\[ai\] usage label=(\S+) provider=(\S+) role=(\S+) model=(\S+) ms=(\d+) ttfb_ms=(\S+) in=(\d+) cached=(\d+) cache_write=(\d+) out=(\d+) reasoning=(\d+)/;

async function usageSince(server, mark) {
  await sleep(400); // the turn route logs right before closing the stream
  return server.lines
    .slice(mark)
    .map((l) => USAGE_RE.exec(l))
    .filter(Boolean)
    .map((m) => ({
      label: m[1], provider: m[2], role: m[3], model: m[4], serverMs: Number(m[5]),
      in: Number(m[7]), cached: Number(m[8]), cacheWrite: Number(m[9]), out: Number(m[10]), reasoning: Number(m[11]),
    }));
}

// ---------------------------------------------------------------------------
// Run one config
// ---------------------------------------------------------------------------

async function runConfig(name) {
  const config = CONFIGS[name];
  console.log(`\n== ${name}: starting dev server on :${PORT}`);
  const server = startServer(config.env);
  currentServer = server;
  const result = { name, label: config.label, models: {}, turns: [], debriefs: [], drills: [], errors: [] };
  try {
    await waitReady();
    await warmUp();

    for (const [scenarioId, script] of Object.entries(SCRIPTS)) {
      for (const variant of ["reflect", "lecture"]) {
        const turns = [{ id: "t0", speaker: "employee", text: script.opening }];
        for (let i = 0; i < script[variant].length; i++) {
          turns.push({ id: `l${i + 1}`, speaker: "learner", text: script[variant][i] });
          const mark = server.lines.length;
          const r = await post("/api/roleplay/turn", { scenarioId, turns }, { stream: true });
          const usage = await usageSince(server, mark);
          const reply = r.status === 200 ? r.text.trim() : "";
          if (r.status !== 200) result.errors.push(`${scenarioId}/${variant} turn ${i + 1}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
          turns.push({ id: `e${i + 1}`, speaker: "employee", text: reply || "(no reply)" });
          result.turns.push({ scenarioId, variant, index: i + 1, status: r.status, ttfb: r.ttfb, ms: r.ms, reply, usage, checks: rolePlayerChecks(reply) });
          process.stdout.write(`  ${scenarioId} ${variant} turn ${i + 1}: ${r.status} ttfb ${Math.round(r.ttfb)}ms\n`);
        }

        const mark = server.lines.length;
        const self = variant === "reflect" ? script.reflectSelf : script.lectureSelf;
        const r = await post("/api/roleplay/debrief", { scenarioId, turns, selfReflection: self });
        const usage = await usageSince(server, mark);
        let debrief = null;
        try {
          debrief = r.status === 200 ? JSON.parse(r.text) : null;
        } catch {}
        if (!debrief) result.errors.push(`${scenarioId}/${variant} debrief: HTTP ${r.status} ${r.text.slice(0, 200)}`);
        const annotations = debrief?.annotations ?? [];
        const designatedId = `l${DESIGNATED[variant].index + 1}`;
        const designated = annotations.find((a) => a.turnId === designatedId);
        const lastEmployee = [...annotations].reverse().find((a) => a.speaker === "employee" && typeof a.intensity === "number");
        result.debriefs.push({
          scenarioId,
          variant,
          setting: script.setting,
          status: r.status,
          ms: r.ms,
          usage,
          designatedMove: designated?.move ?? null,
          designatedOk: DESIGNATED[variant].expect.includes(designated?.move),
          finalIntensity: lastEmployee?.intensity ?? null,
          trajectory: debrief?.trajectory ?? [],
          coach: debrief ? { reflectionResponse: debrief.reflectionResponse, strengths: debrief.strengths, keyMoments: debrief.keyMoments, tryNext: debrief.tryNext, suggestedNextStep: debrief.suggestedNextStep } : null,
          coachChecks: {},
          transcript: turns,
        });
        process.stdout.write(`  ${scenarioId} ${variant} debrief: ${r.status} ${Math.round(r.ms)}ms\n`);
      }
    }

    for (const drill of DRILLS) {
      for (const kind of ["good", "weak"]) {
        const mark = server.lines.length;
        const r = await post("/api/drill/feedback", { drillId: drill.id, response: drill[kind].text });
        const usage = await usageSince(server, mark);
        let fb = null;
        try {
          fb = r.status === 200 ? JSON.parse(r.text) : null;
        } catch {}
        if (!fb) result.errors.push(`${drill.id}/${kind}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
        result.drills.push({
          id: drill.id,
          kind,
          setting: drill.setting,
          status: r.status,
          ms: r.ms,
          usage,
          move: fb?.move ?? null,
          moveOk: drill[kind].expect.includes(fb?.move),
          hitTarget: fb?.hitTarget ?? null,
          hitTargetOk: fb ? fb.hitTarget === (kind === "good") : false,
          feedback: fb,
          checks: {},
        });
        process.stdout.write(`  ${drill.id} ${kind}: ${r.status} move=${fb?.move}\n`);
      }
    }
  } catch (err) {
    result.errors.push(`run aborted: ${err.message}`);
  } finally {
    for (const u of [...result.turns, ...result.debriefs, ...result.drills].flatMap((x) => x.usage)) result.models[u.role] = u.model;
    const errs = server.lines.filter((l) => /\[ai\].*(error|failed|failure)|Error:/i.test(l));
    result.serverErrors = errs.slice(0, 20);
    await server.stop();
    await sleep(1500);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Summaries and report
// ---------------------------------------------------------------------------

const p50 = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sumCost = (usage) => usage.reduce((a, u) => a + cost(u), 0);
const ms = (x) => (Number.isFinite(x) ? `${(x / 1000).toFixed(2)}s` : "n/a");
const usd = (x) => (Number.isFinite(x) ? `$${x.toFixed(4)}` : "n/a");

/** Cost of turns 1..8: a straight-line fit of measured turn cost against turn index (history grows each turn). */
function eightTurnCost(turns) {
  const pts = turns.filter((t) => t.usage.length).map((t) => [t.index, sumCost(t.usage)]);
  if (pts.length < 2) return NaN;
  const mx = mean(pts.map((p) => p[0]));
  const my = mean(pts.map((p) => p[1]));
  const sxx = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0);
  const b = sxx ? pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) / sxx : 0;
  const a = my - b * mx;
  let total = 0;
  for (let i = 1; i <= 8; i++) total += Math.max(0, a + b * i);
  return total;
}

const COACH_FIELDS = ["reflectionResponse", "strengths", "keyMoments", "tryNext"];
const DRILL_FIELDS = ["move", "hitTarget", "observation", "possibleResponses", "tryNext"];

/** Checks are recomputed from the stored outputs, so --from-json picks up check changes without new calls. */
function rescore(r) {
  for (const t of r.turns) t.checks = rolePlayerChecks(t.reply);
  for (const d of r.debriefs) d.coachChecks = feedbackChecks(d.coach, d.setting, COACH_FIELDS);
  for (const d of r.drills) {
    const spec = DRILLS.find((x) => x.id === d.id)[d.kind];
    d.moveOk = spec.expect.includes(d.move);
    d.hitTargetOk = d.feedback ? d.feedback.hitTarget === (d.kind === "good") : false;
    d.checks = feedbackChecks(d.feedback, d.setting, DRILL_FIELDS);
  }
}

function summarize(r) {
  rescore(r);
  for (const u of [...r.turns, ...r.debriefs, ...r.drills].flatMap((x) => x.usage)) r.models[u.role] = u.model;
  const rp = r.turns;
  const rpChecks = rp.flatMap((t) => Object.values(t.checks));
  const pairs = Object.keys(SCRIPTS).map((sid) => {
    const ref = r.debriefs.find((d) => d.scenarioId === sid && d.variant === "reflect");
    const lec = r.debriefs.find((d) => d.scenarioId === sid && d.variant === "lecture");
    const ok = ref?.finalIntensity != null && lec?.finalIntensity != null && ref.finalIntensity > lec.finalIntensity;
    return { sid, ok, ref: ref?.finalIntensity ?? null, lec: lec?.finalIntensity ?? null };
  });
  const obsChecks = [...r.debriefs.map((d) => d.designatedOk), ...pairs.map((p) => p.ok)];
  const coachChecks = r.debriefs.flatMap((d) => Object.values(d.coachChecks));
  const drillChecks = r.drills.map((d) => d.moveOk);
  const drillExtra = r.drills.flatMap((d) => [d.hitTargetOk, ...Object.values(d.checks)]);
  const debriefUsage = r.debriefs.map((d) => d.usage);
  const roleCost = (role) => mean(debriefUsage.map((u) => sumCost(u.filter((x) => x.role === role))));
  const turnCost8 = eightTurnCost(rp);
  const debriefCost = mean(debriefUsage.map(sumCost));
  const drillCost = mean(r.drills.map((d) => sumCost(d.usage)));
  return {
    pairs,
    roles: {
      rolePlayer: { model: r.models.rolePlayer, passed: rpChecks.filter(Boolean).length, total: rpChecks.length, latency: `TTFB p50 ${ms(p50(rp.map((t) => t.ttfb)))} (full reply ${ms(p50(rp.map((t) => t.ms)))})`, costPerSession: turnCost8 },
      observer: { model: r.models.observer, passed: obsChecks.filter(Boolean).length, total: obsChecks.length, latency: `p50 ${ms(p50(debriefUsage.map((u) => u.find((x) => x.role === "observer")?.serverMs)))} (server)`, costPerSession: roleCost("observer") },
      coach: { model: r.models.coach, passed: coachChecks.filter(Boolean).length, total: coachChecks.length, latency: `debrief total p50 ${ms(p50(r.debriefs.map((d) => d.ms)))}`, costPerSession: roleCost("coach") },
      drillCoach: { model: r.models.drillCoach, passed: drillChecks.filter(Boolean).length, total: drillChecks.length, extraPassed: drillExtra.filter(Boolean).length, extraTotal: drillExtra.length, latency: `p50 ${ms(p50(r.drills.map((d) => d.ms)))}`, costPerSession: 3 * drillCost },
    },
    session: turnCost8 + debriefCost + 3 * drillCost,
    turnCost8,
    debriefCost,
    drillCost,
    cacheShare: (() => {
      const all = [...rp, ...r.debriefs, ...r.drills].flatMap((x) => x.usage);
      const inTot = all.reduce((a, u) => a + u.in + u.cached + u.cacheWrite, 0);
      return inTot ? all.reduce((a, u) => a + u.cached, 0) / inTot : NaN;
    })(),
  };
}

const ROLE_NAMES = { rolePlayer: "Role-player", observer: "Observer", coach: "Coach", drillCoach: "Drill coach" };
const quote = (s) => (s ? `"${s.replace(/\s+/g, " ").replace(/\|/g, "\\|")}"` : "(none)");

function renderDoc(results, keep) {
  const sums = Object.fromEntries(results.map((r) => [r.name, summarize(r)]));
  const out = [];
  out.push("# AI provider comparison");
  out.push("");
  out.push(`Generated by \`node apps/web/scripts/compare-providers.mjs\` on ${new Date().toISOString().slice(0, 10)}, against the real routes on a local dev server (port ${PORT}, dev auth, AI_MOCK unset). Each config ran 16 role-play turns (PM-017 and CL-102, 4 reflective and 4 lecturing scripted learner turns each), 4 debriefs, and 12 drill answers (6 drills, one good and one weak answer each). Single run per config, so treat latency as indicative.`);
  out.push("");
  out.push(keep);
  out.push("");
  out.push("## Summary");
  out.push("");
  out.push("| Config | Role | Model | Quality checks passed | Latency | Cost per session |");
  out.push("|---|---|---|---|---|---|");
  for (const r of results) {
    const s = sums[r.name];
    for (const [role, v] of Object.entries(s.roles)) {
      out.push(`| ${r.label} | ${ROLE_NAMES[role]} | \`${v.model ?? "?"}\` | ${v.passed}/${v.total} | ${v.latency} | ${usd(v.costPerSession)} |`);
    }
    out.push(`| ${r.label} | **Session total** | | | | **${usd(s.session)}** |`);
  }
  out.push("");
  out.push("A session is 8 role-play turns + 1 debrief (observer + coach) + 3 drills. Role-play cost per session is a straight-line fit of the measured cost of turns 1 to 4, summed over turns 1 to 8, because each turn resends a longer history. Prices (USD per 1M tokens, input / cache read / cache write / output): " +
    Object.entries(PRICES).map(([m, p]) => `\`${m}\` ${p.input} / ${p.cached} / ${p.write} / ${p.output}`).join("; ") + ". Luna's cache-write price isn't published; 1.25x input is assumed.");
  out.push("");
  out.push("| Config | Session cost | Role-play (8 turns) | Debrief | 3 drills | Share of input served from cache |");
  out.push("|---|---|---|---|---|---|");
  for (const r of results) {
    const s = sums[r.name];
    out.push(`| ${r.label} | ${usd(s.session)} | ${usd(s.turnCost8)} | ${usd(s.debriefCost)} | ${usd(3 * s.drillCost)} | ${Number.isFinite(s.cacheShare) ? `${Math.round(s.cacheShare * 100)}%` : "n/a"} |`);
  }
  out.push("");
  out.push("## What the checks are");
  out.push("");
  out.push("- Role-player, per reply: no meta talk (AI, simulation, scenario, MI terms), at most 4 sentences, no asterisks, one paragraph, not empty. 16 replies x 5 checks.");
  out.push("- Observer: the scripted complex reflection (learner turn 2 of each reflective script) is coded complex-reflection; the scripted advice (learner turn 2 of each lecturing script) is coded advice-without-permission or confront; and for each scenario the reflective transcript ends at a higher counterpart intensity than the lecturing one. 6 checks.");
  out.push("- Coach, per debrief: the JSON parses with all fields; no \"correct\"/\"incorrect\" outside the suggested learner wording; no wrong-setting nouns (clinical never says employee, leader, manager or direct report; workplace never says clinician or \"your patient\"). 4 debriefs x 3 checks.");
  out.push("- Drill coach: `move` matches the expected code for each answer (12). Persuading answers accept advice-without-permission or confront, since a correction is a confront under the observer's rules. Not counted in the table but recorded: hitTarget is true for good answers and false for weak ones, plus the same parse, wording and correct/incorrect checks as the coach.");
  out.push("");
  out.push("## Details");
  for (const r of results) {
    const s = sums[r.name];
    out.push("");
    out.push(`### ${r.label}`);
    out.push("");
    out.push(`Final counterpart intensity, reflective vs lecturing: ${s.pairs.map((p) => `${p.sid} ${p.ref ?? "?"} vs ${p.lec ?? "?"} (${p.ok ? "pass" : "fail"})`).join("; ")}.`);
    out.push(`Observer codes for the scripted turns: ${r.debriefs.map((d) => `${d.scenarioId} ${d.variant} \`${d.designatedMove ?? "none"}\` (${d.designatedOk ? "pass" : "fail"})`).join("; ")}.`);
    out.push(`Drill moves: ${r.drills.map((d) => `${d.id} ${d.kind} \`${d.move ?? "none"}\`${d.moveOk ? "" : " (fail)"}${d.hitTargetOk ? "" : " (hitTarget off)"}`).join("; ")}. Extra drill checks: ${s.roles.drillCoach.extraPassed}/${s.roles.drillCoach.extraTotal}.`);
    const rpFails = r.turns.filter((t) => Object.values(t.checks).some((v) => !v));
    if (rpFails.length) out.push(`Role-player check failures: ${rpFails.map((t) => `${t.scenarioId} ${t.variant} turn ${t.index} (${Object.entries(t.checks).filter(([, v]) => !v).map(([k]) => k).join(", ")}): ${quote(t.reply)}`).join("; ")}.`);
    const coachFails = r.debriefs.filter((d) => Object.values(d.coachChecks).some((v) => !v));
    if (coachFails.length) out.push(`Coach check failures: ${coachFails.map((d) => `${d.scenarioId} ${d.variant} (${Object.entries(d.coachChecks).filter(([, v]) => !v).map(([k]) => k).join(", ")})`).join("; ")}.`);
    if (r.errors.length) out.push(`Errors: ${r.errors.join("; ")}`);
  }
  out.push("");
  out.push("## Same turn, each provider");
  out.push("");
  out.push("Turn 1 has identical input for every config. Later turns differ because each history includes that config's own earlier replies.");
  const picks = [
    ["PM-017", "reflect", 1],
    ["PM-017", "lecture", 2],
    ["CL-102", "reflect", 2],
    ["CL-102", "lecture", 4],
  ];
  for (const [sid, variant, idx] of picks) {
    out.push("");
    out.push(`**${sid}, ${variant === "reflect" ? "reflective" : "lecturing"} script, turn ${idx}.** Learner: ${quote(SCRIPTS[sid][variant][idx - 1])}`);
    out.push("");
    for (const r of results) {
      const t = r.turns.find((x) => x.scenarioId === sid && x.variant === variant && x.index === idx);
      out.push(`- ${r.label}: ${quote(t?.reply)}`);
    }
  }
  out.push("");
  out.push("**Coach, PM-017 lecturing debrief: tryNext and the first key moment.**");
  out.push("");
  for (const r of results) {
    const d = r.debriefs.find((x) => x.scenarioId === "PM-017" && x.variant === "lecture");
    const km = d?.coach?.keyMoments?.[0];
    out.push(`- ${r.label}: ${quote(d?.coach?.tryNext)} Key moment: ${quote(km?.observation)} One option: ${quote(km?.possibleResponses?.[0])}`);
  }
  out.push("");
  out.push("**Coach, CL-102 reflective debrief: reflectionResponse.**");
  out.push("");
  for (const r of results) {
    const d = r.debriefs.find((x) => x.scenarioId === "CL-102" && x.variant === "reflect");
    out.push(`- ${r.label}: ${quote(d?.coach?.reflectionResponse)}`);
  }
  out.push("");
  out.push("**Drill coach, drill-cl-oars-04 weak answer: observation.**");
  out.push("");
  for (const r of results) {
    const d = r.drills.find((x) => x.id === "drill-cl-oars-04" && x.kind === "weak");
    out.push(`- ${r.label}: ${quote(d?.feedback?.observation)}`);
  }
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------------

const names = argVal("--configs", "anthropic,openai").split(",").map((s) => s.trim()).filter(Boolean);
for (const n of names) if (!CONFIGS[n]) throw new Error(`Unknown config ${n}. Known: ${Object.keys(CONFIGS).join(", ")}`);

const jsonPath = argVal("--json", null);
let results = [];
const resume = argVal("--from-json", null);
if (resume) results = JSON.parse(readFileSync(resume, "utf8"));
for (const n of names) {
  results = results.filter((r) => r.name !== n);
  results.push(await runConfig(n));
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify(results, null, 2));
}
results.sort((a, b) => Object.keys(CONFIGS).indexOf(a.name) - Object.keys(CONFIGS).indexOf(b.name));

for (const r of results) {
  const s = summarize(r);
  console.log(`\n${r.label}: session ${usd(s.session)}`);
  for (const [role, v] of Object.entries(s.roles)) console.log(`  ${ROLE_NAMES[role].padEnd(12)} ${String(v.model).padEnd(18)} ${v.passed}/${v.total}  ${v.latency}  ${usd(v.costPerSession)}`);
  if (r.errors.length) console.log(`  errors: ${r.errors.length}`);
}

if (!args.includes("--no-doc")) {
  const docPath = join(ROOT, "docs", "ai-provider-comparison.md");
  let keep = "<!-- keep:start -->\n## Recommendation\n\n(Write the recommendation here; reruns keep this block.)\n<!-- keep:end -->";
  if (existsSync(docPath)) {
    const m = /<!-- keep:start -->[\s\S]*?<!-- keep:end -->/.exec(readFileSync(docPath, "utf8"));
    if (m) keep = m[0];
  }
  writeFileSync(docPath, renderDoc(results, keep));
  console.log(`\nwrote ${docPath}`);
}
