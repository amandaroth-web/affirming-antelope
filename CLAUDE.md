# Affirming Antelope

Duolingo-style Motivational Interviewing practice app. npm-workspaces monorepo.

## Layout

- `apps/web` - Next.js landing page plus the AI API routes (port 3000).
- `apps/mobile` - Expo (expo-router, Expo Go compatible) learner app.
- `packages/core` - `@antelope/core`: shared types, content, and prompts. Consumed as TypeScript source by both apps (no build step).

## Run

- Install: `npm install` at the repo root (single lockfile).
- Web: `npm run web` (or `npm run dev -w web`); build with `npm run build -w web`.
- Mobile: `npm run mobile` (Expo dev server, scan QR with Expo Go); browser preview with `npm run web -w mobile` (port 8081).
- Typecheck everything: `npm run typecheck`.
- Mobile reaches the API via `EXPO_PUBLIC_API_URL`, else the dev machine's LAN host on port 3000 (see `apps/mobile/src/lib/api.ts`).

@apps/web/AGENTS.md
