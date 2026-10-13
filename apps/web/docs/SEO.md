# SEO and Search Console

The marketing site (`affirmingantelope.com`, this app) is what should rank. The learner app
(`app.affirmingantelope.com`) is a product surface: `apps/mobile/scripts/finish-web.py` adds
`<meta name="robots" content="noindex, nofollow">` and an `X-Robots-Tag` header. Its
`robots.txt` allows crawling on purpose, since a disallow would hide the noindex from
crawlers. The trainer dashboard (`/trainer`) is noindexed and crawlable for the same reason.

## What's in place

| Piece | Where |
|---|---|
| `metadataBase`, title template (`%s · Affirming Antelope`), default description | `src/app/layout.tsx` |
| Per-page title, description, canonical, Open Graph, Twitter | `src/lib/seo/metadata.ts` (`pageMetadata`) |
| OG images (1200×630, Fredoka/Nunito, mascot) | `src/lib/og.tsx` + `opengraph-image.tsx` in `/`, `/for/[audience]`, `/guides`, `/guides/[slug]`, `/scenarios`, `/scenarios/[id]` |
| JSON-LD | `src/lib/seo/json-ld.tsx`. Home: Organization, WebSite, SoftwareApplication. Audience pages: SoftwareApplication, FAQPage. `/guides`: BreadcrumbList, ItemList. Guides: Article (with `reviewedBy` and `contributor` once a guide has `reviewedBy`), BreadcrumbList, FAQPage. Organization carries `founder`, `member` and a `contactPoint`. `/about`: AboutPage. `/about/amanda-roth`: Person. `/scenarios`: CollectionPage, ItemList. `/scenarios/[id]`: LearningResource, BreadcrumbList |
| Sitemap | `src/app/sitemap.ts`: home, audience pages, `/guides`, `/scenarios` and every `/scenarios/[id]`, `/about`, `/about/amanda-roth`, non-draft guides (`lastModified` = `updated`) |
| Scenario pages | `src/lib/scenarios.ts` holds the search phrase and title for each scenario (`SCENARIO_SEO`). Add an entry when you add a scenario in `@antelope/core`. Pages only receive a `PublicScenario`, which has no `hiddenBackstory` |
| People | `src/lib/people.ts`. Guide `reviewedBy` takes a slug from there |
| robots.txt | `src/app/robots.ts`: allow `/`, disallow `/api`, `/ingest` |
| www → apex | 308 on the Vercel project domain (`www.affirmingantelope.com` → `affirmingantelope.com`), plus a host-based fallback in `next.config.ts` |
| Drafts | `draft: true` guides render at their URL with `noindex` but are left out of `/guides`, related guides, and the sitemap |

## Keyword targets

One primary query per page, so pages don't compete with each other. Guides target
informational queries; audience pages target "practice/training/tool" queries.

| Page | Primary | Secondary |
|---|---|---|
| `/` | motivational interviewing practice | MI practice app, OARS practice, motivational interviewing role play |
| `/for/clinicians` | motivational interviewing practice for clinicians | MI for nurses, MI for physicians, reflective listening practice |
| `/for/leaders` | motivational interviewing training for healthcare leaders | MI for managers (product intent), difficult conversations practice healthcare |
| `/for/trainers` | motivational interviewing training tools | MI coaching feedback, MI cohort practice, MITI practice between sessions |
| `/guides` | motivational interviewing examples | motivational interviewing guide |
| `/scenarios` | motivational interviewing role play | motivational interviewing scenarios |
| `/scenarios/[id]` | one long-tail phrase per scenario, e.g. "talking to an employee who keeps missing deadlines" | motivational interviewing role play |
| `/guides/what-is-motivational-interviewing` | what is motivational interviewing | MI definition, spirit of MI, four processes |
| `/guides/oars-motivational-interviewing` | OARS motivational interviewing | OARS examples, affirmations in MI |
| `/guides/open-ended-questions-examples` | open ended questions motivational interviewing | open vs closed questions, evocative questions |
| `/guides/reflective-listening-examples` | reflective listening examples | simple vs complex reflections, double-sided reflection |
| `/guides/change-talk-vs-sustain-talk` | change talk vs sustain talk | DARN CAT, change talk examples |
| `/guides/responding-to-sustain-talk` | responding to sustain talk | resistance/discord in MI, rolling with resistance, righting reflex |
| `/guides/motivational-interviewing-for-managers` | motivational interviewing for managers | MI in the workplace, performance conversations |
| `/guides/how-to-practice-motivational-interviewing` | how to practice motivational interviewing | MI training exercises, MI role play |

Watch: `/for/leaders` and the managers guide sit close together. Keep the guide
informational ("how MI works in a performance conversation") and the audience page about
the product ("practice it here"). They link to each other.

## Verify the domain in Google Search Console

Use a **Domain property** (covers `www`, `app.`, http and https).

1. Go to <https://search.google.com/search-console>, choose **Add property → Domain**, and
   enter `affirmingantelope.com`.
2. Google shows a TXT record like `google-site-verification=XXXXXXXX`. Copy it. (Blake: this
   token is yours to fetch; it's tied to your Google account.)
3. Add it in Vercel (the domain uses Vercel nameservers):
   ```sh
   vercel dns add affirmingantelope.com @ TXT "google-site-verification=XXXXXXXX"
   ```
   or in the dashboard: **Domains → affirmingantelope.com → DNS Records → Add**, type `TXT`,
   name `@`, value the full string.
4. Wait a few minutes (`dig TXT affirmingantelope.com +short` should show it), then click
   **Verify**. Leave the record in place; removing it unverifies the property.

## Bing Webmaster Tools

Easiest path: <https://www.bing.com/webmasters> → **Import from Google Search Console**
once GSC is verified. It pulls the site and sitemap across. Otherwise add the site, pick DNS
verification, and add the CNAME or TXT record Bing gives you the same way as above. Bing
also feeds DuckDuckGo, Yahoo, and ChatGPT search.

## Submit the sitemap

- GSC: **Sitemaps** → enter `sitemap.xml` → **Submit**. Should report 13 URLs plus the scenario, about and guide pages (home,
  three audience pages, `/guides`, `/scenarios` and each scenario, `/about`, `/about/amanda-roth`, every published guide).
- Bing: **Sitemaps → Submit sitemap** → `https://affirmingantelope.com/sitemap.xml`.
- After launch, use **URL Inspection → Request indexing** on `/`, the three `/for/*` pages,
  and the two strongest guides to skip the queue.

## 30-day checklist

**Week 1: foundations**
- [ ] Verify GSC and Bing; submit the sitemap; request indexing for the top six URLs.
- [ ] Run the Rich Results Test on `/for/clinicians` (FAQPage) and one guide (Article,
      Breadcrumb, FAQPage). Fix anything flagged.
- [ ] Check the OG cards with the LinkedIn Post Inspector and opengraph.xyz.
- [ ] Confirm `app.affirmingantelope.com` is not indexed (`site:app.affirmingantelope.com`).

**Week 2: first backlinks from people who care about MI**
- [ ] MINT (Motivational Interviewing Network of Trainers): share it with members you know,
      ask about the resources list and the MINT Bulletin. Lead with the free trainer
      dashboard, not the brand.
- [ ] Email 10 residency program directors (family medicine, internal medicine, psychiatry)
      and nursing school MI instructors: a free practice tool for between-session homework.
- [ ] Post in r/motivationalinterviewing, r/socialwork, r/nursing (read each sub's rules on
      self-promotion first; lead with a guide, not the app).

**Week 3: LinkedIn and Product Hunt prep**
- [ ] Three LinkedIn posts from Blake and Amanda: one guide excerpt (an Example exchange works
      well as an image), one short screen recording of a role-play debrief, one "why we built
      it". Link the matching `/for/*` page with `?utm_source=linkedin`.
- [ ] Prepare Product Hunt: tagline ("Duolingo-style practice for Motivational
      Interviewing"), 4 to 5 screenshots, a 30-second video, a maker comment, and a list of
      people to tell on the day. Launch on a Tuesday to Thursday, 12:01am PT.

**Week 4: launch and measure**
- [ ] Product Hunt launch. Add the PH link to the footer for the day.
- [ ] GSC → Performance: note queries with impressions but low CTR; rewrite those titles and
      descriptions (guide `title` ≤ 60 chars, `description` 140 to 160).
- [ ] PostHog: check `cta_clicked` by `location` and `guide_drill_clicked`; double down on the
      guides that send people into drills.
- [ ] Plan the next four guides from GSC queries you're already showing up for.

## Notes

- `robots.txt` on the learner app disallows everything, so Google can't see its `noindex`.
  If `app.affirmingantelope.com` URLs ever show up as "Indexed, though blocked by robots.txt",
  allow crawling there (keep the `noindex`) so Google can read the tag and drop them.
- OG images are generated at build time. After changing a guide's title, redeploy and
  re-scrape the URL in LinkedIn's Post Inspector to refresh the cached card.
