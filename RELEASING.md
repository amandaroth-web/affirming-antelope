# Releasing

Merging to `main` is the release. Nobody deploys by hand.

## How a change ships

1. Branch, push, open a PR.
2. **CI** (`.github/workflows/ci.yml`) runs on the PR: typecheck, site build, app web export, pgTAP DB tests, DB lint, and a check that `packages/core/src/db.types.ts` matches the migrations. All must be green.
3. **Vercel preview deploys** are built for the PR (see below for which project builds when).
4. Merge. Then, in parallel:
   - Vercel production-deploys `affirming-antelope-app` (app.affirmingantelope.com) and `affirming-antelope` (affirmingantelope.com, API, `/trainer`), each only if its paths changed.
   - If `supabase/migrations/**` changed, `.github/workflows/release-db.yml` pushes them to the hosted Supabase project.

### Which project builds when

Each project has an `ignoreCommand` in its `vercel.json` that skips the build when nothing relevant changed (compared with the last deployed commit on that branch, falling back to the previous commit).

| Project | Root Directory | Builds when these change |
|---|---|---|
| `affirming-antelope` (site, API, dashboard) | `apps/web` | `apps/web`, `packages/core`, `package.json`, `package-lock.json` |
| `affirming-antelope-app` (learner web app) | `apps/mobile` | `apps/mobile`, `packages/core`, `package-lock.json` |

A docs-only or `supabase/`-only merge deploys nothing. If the check cannot run (for example the base commit is not in Vercel's shallow clone), the command fails and the build runs, so the failure mode is an extra build, not a missed one.

## Database migrations

New migration: `supabase migration new <name>`, write SQL, then `npm run db:reset && npm run db:test && npm run db:types`, and commit the migration, any test changes and the regenerated `db.types.ts`. CI fails if the types are stale.

On merge, `release-db.yml` runs `supabase link`, prints a dry run of the pending migrations, then `supabase db push`. It runs in the GitHub Environment `production` and fails immediately if its secrets are missing. It can also be run by hand from the Actions tab (`workflow_dispatch`).

### Migrations must be backwards-compatible

Vercel deploys the app and the site at about the same time as the migration runs, and old code keeps serving (and old app builds stay installed on phones) until the new deploy is live. So at every moment, code from the previous release must work against the new schema, and the new code must work against the old one if the migration is delayed or fails.

- Additive first: add tables, nullable columns, or columns with defaults; add functions under new names.
- Never drop or rename a column, table or function, change a type, or add a `NOT NULL` without a default in the same release as the code that stops using it. Ship the code first, and ship the destructive migration in a later release once nothing reads the old shape.
- Tighten RLS and constraints in a separate, later migration than the one that introduces the data.

## Rolling back

- **Site or app:** Vercel dashboard, the project's Deployments tab, pick the last good production deployment, "Promote to Production" (or `vercel promote <deployment-url>`). Instant, no rebuild. Then revert the bad commit on `main` so the next merge does not redeploy it.
- **Database:** forward-only. Do not edit or delete a migration that has reached `main`. Fix a bad migration with a new migration that corrects it, and merge it like any other change. This is why migrations must be additive: promoting an older Vercel deployment is only safe if the older code still works against the current schema.

## Emergencies only: local `vercel deploy --prod`

Do not run `vercel deploy --prod` from a laptop in normal work. It ships whatever is in the working tree, including uncommitted files, so production can end up running code that is in no commit. Use it only if Git-based deploys are down and production is broken, and open a PR with exactly what you deployed straight afterwards. For a bad release, promote or revert (above) instead.

## Environment variables (names only)

Never commit values. Vercel marks secrets as sensitive, so they cannot be read back. Keep a copy in your password manager.

**Vercel `affirming-antelope` (site, API, dashboard)**, Production:
`ANTHROPIC_API_KEY`, `APP_CLIENT_TOKEN`, `CORS_ORIGINS`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_UI_HOST`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`.
Optional, read by the code: `AI_MOCK`, `AI_LOG_USAGE`.
Preview has only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which `next build` needs to prerender `/trainer`. Previews deliberately get no AI key, no analytics key and no app token.

**Vercel `affirming-antelope-app` (learner web app)**, Production and Preview:
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_TOKEN`, `EXPO_PUBLIC_POSTHOG_HOST`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_URL`.
These are inlined into the public bundle, so they are public by design.

**GitHub Environment `production`** (used by `release-db.yml`): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.

**CI** needs no secrets. It builds with dummy `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` values and tests against a throwaway local Supabase stack.

**EAS (native builds)**: the `EXPO_PUBLIC_*` values are committed in `apps/mobile/eas.json`.

### One-time GitHub setup

```sh
gh api -X PUT repos/blakeparkinson/affirming-antelope/environments/production
gh secret set SUPABASE_ACCESS_TOKEN --env production --repo blakeparkinson/affirming-antelope
gh secret set SUPABASE_DB_PASSWORD --env production --repo blakeparkinson/affirming-antelope
```

`SUPABASE_ACCESS_TOKEN` comes from https://supabase.com/dashboard/account/tokens. `SUPABASE_DB_PASSWORD` is the hosted project's database password (Project Settings, Database).
