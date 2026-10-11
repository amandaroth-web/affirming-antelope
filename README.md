# Affirming Antelope

Duolingo-style practice for Motivational Interviewing. npm-workspaces monorepo:

- `apps/web` - Next.js landing page and AI API routes
- `apps/mobile` - Expo learner app (runs in Expo Go)
- `packages/core` - shared types, content, and prompts (`@antelope/core`)

## Getting started

```bash
npm install          # once, at the repo root

npm run web          # Next.js on http://localhost:3000
npm run mobile       # Expo dev server (scan the QR code with Expo Go)
npm run web -w mobile  # Expo in the browser on http://localhost:8081

npm run typecheck    # all workspaces
npm run build -w web
```

The mobile app calls the web app's API routes. Set `EXPO_PUBLIC_API_URL` to override the default (your dev machine's LAN IP on port 3000).

Deploying `apps/web` on Vercel: set the project's Root Directory to `apps/web`.

## API

The AI endpoints live in `apps/web/src/app/api` (Node runtime); shared code is in `apps/web/src/lib/ai`. Request and response types are in `packages/core/src/types.ts`. Errors are always `{ "error": string }` with a real status code.

| Endpoint | Returns |
| --- | --- |
| `POST /api/roleplay/turn` `{scenarioId, turns}` | `text/plain` stream of the employee's next line (max 40 turns, 1500 chars each, last turn must be the learner's) |
| `POST /api/roleplay/debrief` `{scenarioId, turns, selfReflection}` | `Debrief` JSON. Observer call, then Coach call; tallies and trajectory are computed in code |
| `POST /api/drill/feedback` `{drillId, response}` | `DrillFeedback` JSON |

Setup: copy `apps/web/.env.example` to `apps/web/.env.local` and set `ANTHROPIC_API_KEY`. To run some or all roles on OpenAI, set `OPENAI_API_KEY` and `AI_PROVIDER=openai` (or per role, `AI_PROVIDER_COACH=openai` etc.). Provider, model and effort overrides and `CORS_ORIGINS` are documented in the example file; the provider comparison is in `docs/ai-provider-comparison.md`.

- **Mock mode:** with `AI_MOCK=1`, or no API key in development, the endpoints return deterministic canned responses (the turn endpoint streams in small chunks with delays) so the UI can be built without spending tokens. In production with no key they return 503.
- **CORS:** development allows any origin (Expo web on `:8081`, LAN IPs). In production only origins listed in `CORS_ORIGINS` are allowed; native apps are unaffected.
- **Rate limiting:** a simple in-memory per-IP limit. It is per server instance and not production grade; replace it with a shared store (Redis/Upstash) before launch.
