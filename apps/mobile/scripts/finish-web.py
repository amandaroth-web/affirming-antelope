#!/usr/bin/env python3
"""Post-process `expo export --platform web --output-dir dist-web`.

Adds add-to-home-screen tags, an apple-touch-icon, and a vercel.json that
rewrites non-file paths to /index.html (SPA deep links). Run from apps/mobile.
"""
import json
from pathlib import Path
from PIL import Image

out = Path("dist-web")
icon = Image.open("assets/images/icon.png").convert("RGBA")
flat = Image.new("RGBA", icon.size, (255, 255, 255, 255))
flat.alpha_composite(icon)
flat.convert("RGB").resize((180, 180), Image.LANCZOS).save(out / "apple-touch-icon.png")

tags = """<meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Affirming Antelope" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="theme-color" content="#FFFFFF" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  """
html = (out / "index.html").read_text()
if "apple-touch-icon" not in html:
    html = html.replace("</head>", tags + "</head>", 1)
    (out / "index.html").write_text(html)

(out / "vercel.json").write_text(json.dumps({
    "cleanUrls": False,
    "rewrites": [{"source": "/((?!_expo/|assets/|.*\\..*).*)", "destination": "/index.html"}],
}, indent=2) + "\n")
