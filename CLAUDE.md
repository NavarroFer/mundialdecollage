@AGENTS.md

# CPU per visit (GV Cloud)

Since 24 Nov 2026 production runs on a GV Cloud server (Node 22 behind Apache and Cloudflare), no longer on Vercel Hobby. The server's CPU is shared and limited, so every change must keep CPU per visit low:

- Never draw an image (satori `ImageResponse`, sharp) per request: cache what it draws (`lib/share-image-cache.ts`, R2, or ISR). `lib/cost-guards.test.ts` lists the allowed renderers.
- A route that serves the same bytes to everyone sends `Cache-Control` with `s-maxage`. Cloudflare only caches `/api/img*` and `/_next/static/*` (a rule on Javier's side: ask him to add a path if a new route needs it); pages come from Next's own cache. Check with `curl -D -` twice: `cf-cache-status: HIT` for those two paths, `x-nextjs-cache: HIT` for pages.
- Don't use `force-dynamic` or request data (`cookies()`, `headers()`, session) in something that doesn't need it. Prefer `revalidate`.
- New routes that don't read the session stay out of the `proxy.ts` matcher (`proxy.test.ts`).
- Data the client can fetch later (lists, search, map) comes from a cached endpoint, not the server render.
- Pages live under `app/[locale]/(site)/`: `proxy.ts` rewrites every page request to `/<locale>/…` (the address bar never shows it). Public pages listed in `lib/static-pages.ts` also have an `anon/` copy, built ahead and served from Next's cache to visitors with no session or referral. A component on such a page must read the session only through `getCurrentUser()` / `createClient()` (`lib/supabase/server.ts`) and the locale through `getI18n()`, never `cookies()`, `headers()` or `searchParams` directly, or the copy stops being static. After `next build`, the `anon` routes must show `●`, never `ƒ`.
- Public URLs (redirects, payment, certificates, OAuth) come from `getSiteUrl()` (`NEXT_PUBLIC_SITE_URL`), never from `request.url`: behind the proxy the app sees `localhost:3101`.

# Deploys and database

- Pushing or merging to `main` only runs the CI checks (lint, types, tests, build). It does **not** deploy.
- To deploy: merge to `main`, `git pull`, then `~/.venvs/gv/bin/python3 scripts/gvcloud/deploy.py` from the owner's computer (Tailscale on). It uploads what changed since the last deploy, rebuilds and waits for the build. See `docs/migracion-gv-cloud.md`. Use `--dry-run` first.
- Before pushing, check `git log origin/main..HEAD`: another session may be committing in the same repo.
- Migrations: `deploy.py` applies new files added under `supabase/migrations/` since the last deploy, **before** uploading code (SSH tunnel + `psql -1 -v ON_ERROR_STOP=1`, one file at a time, recorded in `.migrations-applied` on the server; if one fails nothing is uploaded). Needs `psql` and a private copy of the DB connection file at `~/gvenue/LEEME-supabase.txt` (mode 600). `--no-migrate` skips them. Never edit an applied migration (create a new one) and never use `supabase db push`: the GV database has no migration history.
- Crons run on the GV Cloud server (set up by Javier). `vercel.json` stays only as a fallback and Vercel's crons are disabled in its dashboard. Vercel and the old Supabase project are kept, frozen, as a way back until the owner decides to turn them off.
