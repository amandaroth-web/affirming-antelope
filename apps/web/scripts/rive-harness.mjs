#!/usr/bin/env node
// Headless test bench for .riv files: drives the official Rive WASM runtime (the copy that
// rive-mcp-server ships) in headless Chrome, binds the default view model, sets view-model
// properties / fires triggers on a script, and records state changes plus PNG frames.
//
//   node scripts/rive-harness.mjs <file.riv> <script.json> [outDir]
//
// script.json: { "stateMachine": "Coach", "width": 300, "fps": 30,
//   "steps": [ {"set": {"mood": 1}}, {"fire": "wave"}, {"run": 1.5, "capture": true} ] }
// "run" advances in 1/60 s ticks; with capture it saves a frame every 1/fps s to outDir.
// Prints a JSON log of { t, states, vm } per step.
import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

function findServer() {
  const root = join(homedir(), ".npm/_npx");
  for (const d of readdirSync(root)) {
    const p = join(root, d, "node_modules/rive-mcp-server");
    if (existsSync(join(p, "assets/canvas_advanced.mjs"))) return join(root, d, "node_modules");
  }
  throw new Error("rive-mcp-server not in the npx cache; run `npx -y rive-mcp-server` once");
}

const NM = findServer();
const { chromium } = await import(join(NM, "playwright-core/index.mjs"));
const ASSETS = join(NM, "rive-mcp-server/assets");

const [rivPath, scriptPath, outDir] = process.argv.slice(2);
if (!rivPath || !scriptPath) {
  console.error("usage: rive-harness.mjs <file.riv> <script.json> [outDir]");
  process.exit(1);
}
const script = JSON.parse(readFileSync(scriptPath, "utf8"));
const riv = readFileSync(resolve(rivPath)).toString("base64");

const PAGE = String.raw`
import RiveFactory from "/canvas_advanced.mjs";
const rive = await RiveFactory({ locateFile: (f) => "/" + f });
function b64(b) { const s = atob(b); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
window.run = async (data, script) => {
  const file = await rive.load(b64(data));
  if (!file) throw new Error("load failed");
  const ab = file.artboardByIndex(0);
  const def = script.stateMachine ? ab.stateMachineByName(script.stateMachine) : ab.stateMachineByIndex(0);
  if (!def) throw new Error("no state machine");
  const sm = new rive.StateMachineInstance(def, ab);
  let vmi = null;
  try {
    const vm = file.defaultArtboardViewModel(ab);
    vmi = vm && vm.instanceCount > 0 ? vm.instanceByIndex(0) : vm && vm.defaultInstance();
    if (vmi) { sm.bindViewModelInstance(vmi); }
  } catch (e) { console.log("vm bind failed " + e); }
  const b = ab.bounds;
  const W = script.width || 300;
  const H = Math.round(W * (b.maxY - b.minY) / (b.maxX - b.minX));
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H; document.body.appendChild(canvas);
  const renderer = rive.makeRenderer(canvas);
  const ctx = canvas.getContext("2d");
  const frames = []; const log = []; let t = 0;
  const changes = () => { const s = []; for (let i = 0; i < sm.stateChangedCount(); i++) s.push(sm.stateChangedNameByIndex(i)); return s; };
  const draw = () => {
    renderer.clear(); renderer.save();
    renderer.align(rive.Fit.contain, rive.Alignment.center, { minX: 0, minY: 0, maxX: W, maxY: H }, ab.bounds);
    ab.draw(renderer); renderer.restore(); rive.resolveAnimationFrame();
    ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = script.background || "#f4efe4"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    frames.push(canvas.toDataURL("image/png").split(",")[1]);
  };
  // let embedded images decode before the first frame
  sm.advanceAndApply(0); await new Promise((r) => setTimeout(r, 300));
  const fps = script.fps || 30; const dt = 1 / 60;
  for (const step of script.steps) {
    const entry = { t: +t.toFixed(3) };
    if (step.set) for (const [k, v] of Object.entries(step.set)) {
      if (!vmi) throw new Error("no view model instance");
      if (typeof v === "boolean") vmi.boolean(k).value = v; else vmi.number(k).value = v;
    }
    if (step.fire) { if (!vmi) throw new Error("no view model instance"); vmi.trigger(step.fire).trigger(); }
    if (step.run) {
      const states = []; let next = 0; const n = Math.round(step.run / dt);
      for (let i = 0; i < n; i++) {
        sm.advanceAndApply(dt); t += dt;
        for (const s of changes()) states.push(s + "@" + t.toFixed(2));
        if (step.capture && t + 1e-6 >= next) { draw(); next = t + 1 / fps; }
      }
      entry.states = states;
    } else { sm.advanceAndApply(0); entry.states = changes(); }
    log.push(entry);
  }
  return { log, frames };
};
window.__ready = true;
`;

const html = `<!DOCTYPE html><html><body><script type="module">${PAGE}</script></body></html>`;
const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true }));
const ctx = await browser.newContext();
await ctx.route("http://bench.local/**", (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
  if (u.pathname === "/canvas_advanced.mjs") return route.fulfill({ contentType: "text/javascript", body: readFileSync(join(ASSETS, "canvas_advanced.mjs"), "utf8") });
  if (u.pathname.endsWith(".wasm")) return route.fulfill({ contentType: "application/wasm", body: readFileSync(join(ASSETS, "rive.wasm")) });
  return route.fulfill({ status: 404, body: "" });
});
const page = await ctx.newPage();
page.on("console", (m) => console.error("[page]", m.text()));
page.on("pageerror", (e) => console.error("[page error]", e.message));
await page.goto("http://bench.local/");
await page.waitForFunction("window.__ready === true", null, { timeout: 30000 });
try {
  const { log, frames } = await page.evaluate(([d, s]) => window.run(d, s), [riv, script]);
  if (outDir && frames.length) {
    mkdirSync(outDir, { recursive: true });
    for (const f of readdirSync(outDir)) if (/^f\d+\.png$/.test(f)) unlinkSync(join(outDir, f));
    frames.forEach((f, i) => writeFileSync(join(outDir, `f${String(i + 1).padStart(4, "0")}.png`), Buffer.from(f, "base64")));
  }
  console.log(JSON.stringify({ log, frames: frames.length }, null, 0));
} finally {
  await browser.close();
}
