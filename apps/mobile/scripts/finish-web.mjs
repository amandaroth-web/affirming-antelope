// Post-processes the Expo web export in dist-web for app.affirmingantelope.com.
// Dependency-free so it runs in Vercel's build image (the old Python version
// needed Pillow). Adds add-to-home-screen tags and the apple-touch-icon, and
// noindexes every page: the learner app is a product surface, and
// affirmingantelope.com is what ranks. robots.txt allows crawling on purpose,
// since a disallow would hide the noindex from crawlers.
import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = "dist-web";
const routing = JSON.parse(readFileSync("vercel.json", "utf8"));

copyFileSync("web/apple-touch-icon.png", join(out, "apple-touch-icon.png"));

const tags = `<meta name="robots" content="noindex, nofollow" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Affirming Antelope" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="theme-color" content="#FFFFFF" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  `;

// Every exported HTML file gets the tags (index.html serves the SPA routes; Expo
// may also emit +not-found.html and friends).
function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}
for (const page of htmlFiles(out)) {
  const html = readFileSync(page, "utf8");
  if (!html.includes("apple-touch-icon")) writeFileSync(page, html.replace("</head>", `${tags}</head>`));
}

writeFileSync(join(out, "robots.txt"), "User-agent: *\nAllow: /\n");

// For direct CLI deploys of dist-web; Git builds read apps/mobile/vercel.json itself.
writeFileSync(
  join(out, "vercel.json"),
  JSON.stringify({ cleanUrls: routing.cleanUrls, headers: routing.headers, rewrites: routing.rewrites }, null, 2) + "\n",
);
