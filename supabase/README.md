# Supabase (local + hosted)

Schema, RLS, RPCs and seed for Affirming Antelope. The contract is `docs/data-model.md`.

## Everyday commands (repo root, Docker running)

| | |
|---|---|
| `npm run db:start` | Start the local stack (`supabase start`). First run applies migrations + seed. |
| `npm run db:reset` | Drop and rebuild the local DB from `migrations/` + `seed.sql`. |
| `npm run db:test` | Run the pgTAP suite in `tests/` (`supabase test db`). |
| `npm run db:types` | Regenerate `packages/core/src/db.types.ts` after a schema change. |
| `supabase status` | URLs and keys for the running stack. |
| `supabase stop` | Stop it (data is kept). |

New migration: `supabase migration new <name>`, write SQL, `npm run db:reset`, `npm run db:test`, `npm run db:types`.

## Local URLs (from `supabase status`)

- API: http://127.0.0.1:54321 (REST `/rest/v1`, Auth `/auth/v1`, Storage `/storage/v1`)
- Studio: http://127.0.0.1:54323
- Mailpit (OTP emails land here): http://127.0.0.1:54324
- Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Keys: `supabase status` prints the publishable/anon key (public local default) and the
  secret/service-role key (server only).

App env: `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile),
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (web). On a phone, use the
dev machine's LAN IP instead of 127.0.0.1.

## Seed accounts

Sign in with the email, then read the 6-digit code in Mailpit.

| Email | Who |
|---|---|
| rosa@example.com | Dr. Rosa Lin, trainer (`can_train`), owns the cohort |
| amanda@example.com | Amanda, learner; PM-017 role-play submitted, awaiting review |
| jordan@example.com | Jordan, learner; partway through the assignment |
| priya@example.com | Priya, learner; no recent activity |
| marcus@example.com | Marcus, learner; EN-003 submission reviewed by Rosa (unseen) |

Cohort "MI for Leaders — Fall pilot", join code `MIL-DEMO`, assignment "Week 5 Evoking"
(2 evoking drills + EN-003) due next Friday. Trainer code: `TRAIN-PILOT`.

## Hosted project

```sh
supabase login
supabase link --project-ref <project-ref>
supabase db push            # applies migrations/ (never the seed)
```

`db push` doesn't carry auth settings. Either run `supabase config diff` then
`supabase config push` (pushes `config.toml`, including the localhost `site_url` and dev
rate limits, so review the diff), or set these by
hand in the hosted dashboard:

- **Auth > Sign In / Providers > Email**: enabled, signups on, email OTP length 6,
  OTP expiry 600 s, confirm email off.
- **Auth > Email Templates**: "Magic Link" and "Confirm signup" use the subject
  `Your Affirming Antelope code: {{ .Token }}` and the body in `templates/otp.html`.
- **Auth > URL Configuration**: Site URL = the web app's URL; redirect URLs add
  `antelope://**` and any web origins.
- **Auth > SMTP**: a real SMTP provider (the built-in sender is heavily rate limited).
- **Auth > Rate Limits**: keep the hosted defaults; the local values are loosened for dev.
- Trainer codes: insert into `app_private.trainer_codes` from the SQL editor.
