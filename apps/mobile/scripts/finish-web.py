#!/usr/bin/env python3
"""Post-process `expo export --platform web --output-dir dist-web`.

Adds add-to-home-screen tags, an apple-touch-icon, and a vercel.json that
rewrites non-file paths to /index.html (SPA deep links). Run from apps/mobile.

The learner app is a product surface, not a landing page: every response is
noindexed (meta tag and X-Robots-Tag), so affirmingantelope.com is what ranks.
robots.txt allows crawling on purpose: a disallow would stop crawlers from
seeing the noindex, and linked URLs could still be indexed without content.
"""
import json
from pathlib import Path
from PIL import Image

out = Path("dist-web")
icon = Image.open("assets/images/icon.png").convert("RGBA")
flat = Image.new("RGBA", icon.size, (255, 255, 255, 255))
flat.alpha_composite(icon)
flat.convert("RGB").resize((180, 180), Image.LANCZOS).save(out / "apple-touch-icon.png")

tags = """<meta name="robots" content="noindex, nofollow" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Affirming Antelope" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="theme-color" content="#FFFFFF" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  """
# Every exported HTML file gets the tags (index.html serves the SPA routes; Expo
# may also emit +not-found.html and friends).
for page in out.rglob("*.html"):
    html = page.read_text()
    if "apple-touch-icon" not in html:
        html = html.replace("</head>", tags + "</head>", 1)
        page.write_text(html)

(out / "robots.txt").write_text("User-agent: *\nAllow: /\n")

(out / "vercel.json").write_text(json.dumps({
    "cleanUrls": False,
    # Belt and braces for non-HTML responses and crawlers that skip the meta tag.
    "headers": [{"source": "/(.*)", "headers": [{"key": "X-Robots-Tag", "value": "noindex, nofollow"}]}],
    "rewrites": [{"source": "/((?!_expo/|assets/|.*\\..*).*)", "destination": "/index.html"}],
}, indent=2) + "\n")
