# Guides content format

One file per guide: `apps/web/content/guides/<slug>.mdx`, rendered at `/guides/<slug>`.
The slug is the filename and is the URL, so make it the search phrase (`oars-motivational-interviewing`).

```mdx
---
title: "OARS in motivational interviewing, with examples"   # <= 60 chars, the <title>
description: "…"                      # 140–160 chars, the meta description
keywords: ["oars motivational interviewing", "open questions examples"]
audience: all                          # clinicians | leaders | trainers | all
updated: 2026-10-12
readingMinutes: 7
drillId: drill-oars-04                 # the guide's main "try it" drill (a real id in packages/core)
related: [change-talk-vs-sustain-talk] # other guide slugs
faq:                                   # 3–5, rendered as an FAQ section + FAQPage JSON-LD
  - q: "What does OARS stand for?"
    a: "Open questions, affirmations, reflections, and summaries…"
draft: false                           # true = not listed, noindex
---

Markdown body. Use `##` / `###` headings (no `#`; the title is the H1).

Components available in the body:

<Example speaker="Employee">I understand why you're asking, but it's not a big deal.</Example>
<Example speaker="You" kind="reflection">You don't see it as a problem yet.</Example>   (kind: open-question | reflection | complex-reflection | affirmation | summary | avoid)
<Callout title="Try it">Short tip.</Callout>
<TryDrill id="drill-oars-04" label="Practice a complex reflection" />
```

Content is a draft until a trainer reviews it; keep `// DRAFT` out of the file, track review in the PR.
