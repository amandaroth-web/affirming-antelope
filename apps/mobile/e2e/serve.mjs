// Static server for the web export with an SPA fallback (every unknown path gets
// index.html, like Vercel's rewrites), for the composer e2e tests.
// Usage: node e2e/serve.mjs <dir> <port>
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "dist-web");
const port = Number(process.argv[3] ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".riv": "application/octet-stream",
  ".txt": "text/plain",
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  const file = normalize(join(root, path));
  const send = (body, type) => {
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };
  try {
    if (!file.startsWith(root + sep)) throw new Error("outside root");
    send(await readFile(file), types[extname(file)] ?? "application/octet-stream");
  } catch {
    send(await readFile(join(root, "index.html")), types[".html"]);
  }
}).listen(port, "127.0.0.1", () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
