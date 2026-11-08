---
last_mapped_commit: 6f52dfd
---

# External Integrations

**Analysis Date:** 2026-11-08

## APIs & External Services

**Payments - Mercado Pago (ARS, Argentina):**
- Used for one-off payments (entries, donations, workshops, magazine, coin packs) and monthly store subscriptions (preapprovals) in pesos.
- SDK/Client: `mercadopago` 3.6.1 (`lib/mercadopago.ts` builds `MercadoPagoConfig`; `lib/mp-subscriptions.ts` uses `PreApproval` and `Invoice`)
- Payment-provider adapter: `lib/payments/providers/mercadopago.ts` (tests in `lib/payments/providers/mercadopago.test.ts`)
- Auth: `MERCADOPAGO_ACCESS_TOKEN` (server). `NEXT_PUBLIC_MP_PUBLIC_KEY` for the browser.
- Probe script: `scripts/probe-mp-subscription.mjs`
- Shared account note: the same MP account also receives charges for another project (see project memory); only site references count.

**Payments - PayPal (international and club plans):**
- Used for PayPal orders, captures, and recurring plans (club memberships).
- Client: no SDK on the server. `lib/payments/paypal/client.ts` calls `https://api-m.paypal.com` when `PAYPAL_ENV=live`, otherwise `https://api-m.sandbox.paypal.com`.
- Server logic: `lib/payments/paypal/handlers.ts`, `lib/payments/paypal/plans.ts`, adapter `lib/payments/providers/paypal.ts`
- Browser: `@paypal/react-paypal-js` 10.5.2 (PayPal JS SDK); client id `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- Auth: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, webhook verification with `PAYPAL_WEBHOOK_ID`
- Plan ids: `PAYPAL_PLAN_ID_CLUB_MONTHLY`, `PAYPAL_PLAN_ID_CLUB_ANNUAL`, `PAYPAL_PLAN_ID_SOCIO_PREMIUM`, `PAYPAL_PLAN_ID_MIEMBRO`, `PAYPAL_PLAN_ID_INICIAL`
- Setup script: `scripts/paypal-setup.mjs`

**Email - Resend (primary transactional provider):**
- Sends transactional and campaign mail; batches of up to 100 (`RESEND_BATCH_SIZE` in `lib/resend.ts`), with a 600 ms pause between batches (`lib/mail/transports.ts`).
- SDK/Client: `resend` 6.28.1 (`lib/resend.ts`)
- Auth: `RESEND_API_KEY` (sending). `RESEND_DOMAIN_API_KEY` must be a "Full access" key for domain management calls.
- Webhook: `app/api/resend/webhook/route.ts`, secret `RESEND_WEBHOOK_SECRET` (`lib/resend-signature.ts`, test `lib/resend-signature.test.ts`)
- Routing: `lib/mail/index.ts` picks a provider per mail at send time (strategy pattern); `lib/mail-quota.ts` moves to the next provider when one is out of quota.

**Email - Brevo (fallback provider):**
- Used when Resend is over quota or unconfigured. Calls `https://api.brevo.com/v3/smtp/email` directly with `fetch` (`lib/mail/transports.ts`).
- Auth: `BREVO_API_KEY`
- Webhook: `app/api/brevo/webhook/route.ts`, secret `BREVO_WEBHOOK_SECRET` (`lib/mail/webhook.ts`, event mapping in `lib/mail/events.ts`)
- Admin view: `app/[locale]/(site)/admin/envios/page.tsx`

**Shipping - Correo Argentino (MiCorreo API):**
- Shipping quotes and pickup branches for Argentina.
- Client: direct `fetch` (`lib/correo.ts`); base `https://api.correoargentino.com.ar/micorreo/v1`, or `https://apitest.correoargentino.com.ar/micorreo/v1` when `CORREO_API_ENV=test`
- Auth: Basic auth on `/token` with `CORREO_API_USER` and `CORREO_API_PASSWORD`, then a bearer token cached in memory (about 4 minutes); `CORREO_CUSTOMER_ID`
- Branch data: `lib/correo-branches.ts`, `lib/argentina-provinces.json`; branch lookups cached 15 minutes (`lib/correo.ts`)
- Pricing config: `CORREO_ORIGIN_POSTAL_CODE`, `CORREO_PACKAGES_JSON`, `CORREO_SHIPPING_RATE_MODE`, `CORREO_FLAT_SHIPPING_FEE`
- Routes: `app/api/shipping/quote/route.ts`, `app/api/shipping/branches/route.ts`
- Notices: `lib/shipment-notices.ts`, `lib/pickup-copy.ts`

**AI - Anthropic Claude (email translation):**
- Translates campaign email copy into the site locales.
- SDK/Client: `@anthropic-ai/sdk` 0.128.0 (`lib/email-translator.ts`), model `claude-sonnet-5`
- Auth: `ANTHROPIC_API_KEY`; `ANTHROPIC_WORKSPACE_ID`
- Tests: `lib/email-translation.test.ts`

**Google Sheets (Registro form intake):**
- The Registro sheet holds artist registrations; the site reads it and syncs them.
- Client: no SDK. `lib/google-sheets.ts` signs a JWT (`node:crypto`, RS256) and exchanges it at `https://oauth2.googleapis.com/token` for a read-only token (`https://www.googleapis.com/auth/spreadsheets.readonly`).
- Auth: service account. `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. The sheet must be shared (Viewer) with the service-account email.
- Sheet id: `REGISTRO_SHEET_ID`
- Sync logic: `lib/registro-sync.ts`, `lib/registro.ts`, `lib/registro-image-fingerprint.ts`
- Driven by cron `/api/cron/registro` (every 2 hours) and by `scripts/sync-registro.mts`, `scripts/sync-contactos-sheets.mts`
- Google Apps Script: `scripts/apps-script/Registro.gs` (lives in Google's Apps Script runtime, not in Vercel); `scripts/apps-script-registro.test.mts` covers it

**Cloudflare R2 (image cache, S3 API):**
- Stores originals and resized variants fetched from Supabase Storage, so repeated cache misses do not re-download from Supabase.
- Client: `aws4fetch` 1.0.20 (`lib/r2.ts`, region `auto`)
- Auth: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. The bucket stays private.
- Used by: `app/api/img/route.ts` (photos), `lib/share-image-cache.ts` (share images drawn with satori/sharp; key includes `SHARE_IMAGE_TEMPLATE`)
- Fallback: if any R2 variable is missing, `imageStore()` returns null and images are resized straight from Storage.

**Microsoft Clarity (session recording):**
- Loaded with `next/script` `strategy="lazyOnload"` in `components/clarity.tsx` from `https://www.clarity.ms/tag/<id>`; the project id comes from `NEXT_PUBLIC_CLARITY_PROJECT_ID`.
- Ad-blocker workaround: `app/monitoring/[...path]/route.ts` proxies `*.clarity.ms` through the site's own domain. It drops visitor cookies, caches the tag (`s-maxage=600`) and the script (`s-maxage=86400`).

**Vercel platform services:**
- Web Analytics and Speed Insights: `@vercel/analytics` 2.0.1 and `@vercel/speed-insights` 2.0.0, mounted via `components/vercel-analytics.tsx`
- Cron: five jobs declared in `vercel.json` (see the Webhooks & Callbacks section below)
- Deploy hook: triggered from GitHub Actions (`VERCEL_DEPLOY_HOOK_URL`, see CI/CD below)

**Supabase Management API (usage monitor):**
- Reads API request counts for the project to warn before the quota is exhausted (`lib/supabase-monitor.ts`, base `https://api.supabase.com/v1`).
- Auth: `SUPABASE_USAGE_ALERT_TOKEN`; project ref `SUPABASE_PROJECT_REF` (defaults to the project in code).
- Read by the infra cron `/api/cron/infra`.

**Instagram (handle parsing only):**
- `lib/instagram.ts` normalizes handles and profile links (`@handle`, bare handle, `instagram.com/...`). It excludes the brand's own accounts. No Instagram API or SDK is called.
- Artist social route: `app/api/artistas/[slug]/social/route.ts`

**Playwright (local tooling only):**
- Renders PDFs and avatar art in build scripts (`scripts/build-bases-pdf.mts`, `scripts/avatars/build.mjs`). Not called at request time.

## Data Storage

**Primary database - Supabase Postgres:**
- Connection: `NEXT_PUBLIC_SUPABASE_URL` (browser and server), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (RLS-bound client), `SUPABASE_SERVICE_ROLE_KEY` (server-only admin client that bypasses RLS)
- Clients:
  - `lib/supabase/client.ts` - browser client (`@supabase/supabase-js` with `@supabase/ssr`)
  - `lib/supabase/server.ts` - server client bound to request cookies; `createClient()` and `getCurrentUser()`
  - `lib/supabase/admin.ts` - service-role client; server only
  - `lib/supabase/public.ts` - anon client for public data
  - `lib/supabase/config.ts` - `isSupabaseConfigured` gate; everything falls back to a "not configured" path when unset (CI relies on this)
- Schema: 106 migrations in `supabase/migrations/`, applied to production by CI (see CI/CD)
- Local testing: no local Postgres. SQL is tested in-process with PGlite (`scripts/pglite/harness.mjs`, `scripts/test-*-db.mts`)
- Realtime via this database is covered under Realtime below
- Major areas (from migration names): profiles and visibility, artworks and buckets, workshop registrations and capacity locks, campaign delivery tracking, template blocks, legacy submissions, donations, club galleries (`club_*`), coin pack purchases, club stamps and bonus stamps

**File storage - Supabase Storage:**
- Public bucket for artwork photos. Served through `app/api/img/route.ts`, which resizes with sharp and caches in R2.
- `next.config.mjs` allows remote images from `https://*.supabase.co/storage/v1/object/public/**` (for the custom loader).
- Bucket limits are set in migration `20260918010000_artworks_bucket_limits.sql`.

**Cloudflare R2 (cache, not primary storage):** see APIs above.

**Caching:**
- Next.js Data Cache: `unstable_cache` via `lib/public-data-cache.ts`; tags in `lib/public-cache-tags.ts`; refresh helpers: `refreshPublicData`, `refreshArtworkData`, `refreshExhibition`
- CDN: Vercel edge cache with `Cache-Control: s-maxage` on routes that serve the same bytes to everyone (see `CLAUDE.md`)
- No Redis, Memcached or other external cache

**Local data files:**
- `data/`, `lib/argentina-provinces.json`, `lib/country-codes.ts`, `lib/iso-numeric-country-codes.ts` - static reference data bundled in the app

## Authentication & Identity

**Auth provider - Supabase Auth:**
- Sign-in with Supabase Auth. Google sign-in needs Google Auth verification before launch (pre-launch checklist in `ROADMAP.md`).
- Implementation: `@supabase/ssr` cookie sessions. Cookies are named `sb-<project>-auth-token*` (`proxy.ts` `hasSupabaseSession`).
- `proxy.ts` refreshes the session cookie on every page request for signed-in visitors, and sends visitors with a session to the non-anonymous page copy (`/<locale>/...` rather than `/<locale>/anon/...`)
- Callback route: `app/[locale]/(site)/auth/callback/route.ts`; open-redirect guard in `lib/safe-next.ts`
- Admin access: `lib/admin.ts`, `lib/admin-artwork-controls.ts`
- Profile visibility and grants: migrations `20260916000000_profiles.sql`, `20260918040000_profiles_grants.sql`, `20260918050000_authenticated_table_grants.sql`

**Signed links and tokens (app-owned, not third-party):**
- Mail unsubscribe: `app/api/unsubscribe/route.ts`, links built in `lib/mail-links.ts`
- Certificate links: `lib/certificate-token.ts` with `CERTIFICATE_SECRET`
- Cron: `lib/cron.ts` `isAuthorizedCron()` requires `Authorization: Bearer $CRON_SECRET`

## Realtime

**Supabase Realtime (presence and live counters):**
- Used in two places, both behind kill switches:
  - Home live stats: `components/use-live-home-stats.ts` uses a private channel (`client.channel(HOME_STATS_TOPIC, { config: { private: true } })`). Switch: `NEXT_PUBLIC_HOME_LIVE=off`.
  - Gallery presence: `components/gallery/presence/GalleryPresence.tsx` uses presence on per-artwork topics. Switch: `NEXT_PUBLIC_GALLERY_LIVE=off`.
- Both share the Realtime quota of the free plan; see the project's realtime cost notes.

## 3D Gallery Assets

- The 3D gallery (Three.js/R3F/Rapier) loads people models and textures from a CDN base set by `NEXT_PUBLIC_GALLERY_ASSETS_URL` (read in `components/gallery/world/people/cast.ts`). When unset (local dev or switched off), the cast falls back to local files.
- Assets are processed with `@gltf-transform/cli` (devDependency).

## Monitoring & Observability

**Error tracking:**
- Not detected (no Sentry or similar SDK in `package.json` or source)

**Analytics:**
- Vercel Web Analytics and Speed Insights (see above)
- Microsoft Clarity via `components/clarity.tsx`, proxied by `app/monitoring/[...path]/route.ts`
- First-party visit tracking: `app/api/track/route.ts`, `lib/track.ts`, `lib/track-server.ts`, `lib/visit-source.ts`, `lib/funnel.ts`

**Logs:**
- Server `console` logging in route handlers; no external log drain detected
- Vercel runtime logs are the primary production log source

**Usage monitoring:**
- Supabase quota and API count via `lib/supabase-monitor.ts` (infra cron)
- Mail quota per provider via `lib/mail-quota.ts`

## CI/CD & Deployment

**Hosting:**
- Vercel, project `mundialdecollage` (linked in `.vercel/project.json`), Hobby plan with a strict Active CPU budget (see `CLAUDE.md`)
- `vercel.json` sets `git.deploymentEnabled.main: false`, so pushes to `main` do not auto-deploy. Preview deployments for other branches still run.

**CI pipeline (GitHub Actions):**
- `.github/workflows/ci.yml` - runs on push to `main`, on every pull request, and on manual dispatch:
  1. `check` job (Node 22, `npm ci`): `npm run lint`, `npx next typegen`, `npx tsc --noEmit`, `npm test`, `npm run build` (built without Supabase or Mercado Pago env vars on purpose)
  2. `migrate` job (needs `check`; `main` only): calls `.github/workflows/supabase-migrations.yml`
  3. `deploy` job (needs `check` and `migrate`; `main` only): verifies the run is still the tip of `main`, then POSTs `VERCEL_DEPLOY_HOOK_URL`. The build runs on Vercel. Concurrency group `production-deploy` cancels superseded runs.
- `.github/workflows/supabase-migrations.yml` - reusable and manual: `supabase/setup-cli@v1` (latest), `supabase link --project-ref` (the project ref is set as the `SUPABASE_PROJECT_ID` env value in the file), `supabase db push --remote`. Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`. Concurrency group `supabase-migrations`, never cancelled.

**Secrets (CI):**
- GitHub Actions secrets: `VERCEL_DEPLOY_HOOK_URL`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
- Vercel environment variables hold the production app secrets; the build runs on Vercel so these never appear in public CI logs

## Environment Configuration

**Required env vars for the app to work fully (names only):**
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Site: `NEXT_PUBLIC_SITE_URL`, `BRAND_NAME`
- Payments: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `PAYPAL_WEBHOOK_ID`
- Email: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `BREVO_API_KEY` (fallback)
- Cron and security: `CRON_SECRET`, `CERTIFICATE_SECRET`

**Optional or feature-gated:**
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (image cache)
- `CORREO_*` (shipping quotes), `GOOGLE_SERVICE_ACCOUNT_*` and `REGISTRO_SHEET_ID` (Registro sync), `ANTHROPIC_API_KEY` (translation), `SUPABASE_USAGE_ALERT_TOKEN` and `SUPABASE_PROJECT_REF` (usage monitor), `NEXT_PUBLIC_CLARITY_PROJECT_ID`, `NEXT_PUBLIC_GALLERY_ASSETS_URL`
- Kill switches: `NEXT_PUBLIC_GALLERY_LIVE=off`, `NEXT_PUBLIC_HOME_LIVE=off`, `CLUB_OPEN`

**Secrets location:**
- Production and preview: Vercel project environment variables
- CI: GitHub Actions repository secrets
- Local: `.env.local` at the repo root (git-ignored). Do not copy its values into docs or commits.

## Webhooks & Callbacks

**Incoming (route handlers):**
- `app/api/mercadopago/webhook/route.ts` - Mercado Pago payment and preapproval events; verified by `lib/mercadopago-signature.ts` (`x-signature` header, `MERCADOPAGO_WEBHOOK_SECRET`)
- `app/api/paypal/webhook/route.ts` - PayPal events; `PAYPAL_WEBHOOK_ID`, runs on `nodejs`
- `app/api/paypal/return/route.ts` - PayPal return URL after approval (`runtime = 'nodejs'`)
- `app/api/paypal/orders/route.ts`, `app/api/paypal/orders/[id]/capture/route.ts`, `app/api/paypal/subscriptions/route.ts` - checkout calls from the browser
- `app/api/resend/webhook/route.ts` - Resend delivery events; `RESEND_WEBHOOK_SECRET`
- `app/api/brevo/webhook/route.ts` - Brevo delivery events; `BREVO_WEBHOOK_SECRET`
- `app/api/unsubscribe/route.ts` - email unsubscribe link target (signed link)
- `app/api/track/route.ts` - first-party visit and funnel events
- `app/api/gallery/attention/route.ts` - gallery attention events from the browser
- `app/[locale]/(site)/auth/callback/route.ts` - Supabase Auth callback
- `app/api/stamps/route.ts`, `app/api/club/casas/route.ts`, `app/api/artworks/surprise/route.ts`, `app/api/obras/route.ts`, `app/api/obras/[slug]/route.ts`, `app/api/artistas/[slug]/social/route.ts` - internal JSON endpoints for the site (not third-party webhooks)
- `app/api/img/route.ts` - image proxy/resizer for Supabase Storage photos (cached at the CDN and in R2)
- `app/monitoring/[...path]/route.ts` - Clarity proxy
- `app/[locale]/(site)/ar/[slug]/tarjetas/route.ts`, `app/[locale]/(site)/obras/[slug]/certificado/route.ts` - generated PDFs (certificate, print cards)

**Scheduled (Vercel cron, all require `Authorization: Bearer $CRON_SECRET`):**
- `/api/cron/registro` - every 2 hours (`0 */2 * * *`); Registro sheet sync (`lib/registro-sync.ts`)
- `/api/cron/exhibition` - daily 12:05 UTC (`5 12 * * *`); exhibition day mail (`lib/exhibition-day.ts`, `lib/exhibition-mail.ts`)
- `/api/cron/campanas` - daily 12:10 UTC (`10 12 * * *`); campaign sends (`lib/campaign-schedule.ts`, `lib/campaign-delivery.ts`)
- `/api/cron/certificados` - daily 00:15 UTC (`15 0 * * *`); certificate mail (`lib/certificate-mail.ts`)
- `/api/cron/infra` - daily 12:20 UTC (`20 12 * * *`); Supabase usage check (`lib/supabase-monitor.ts`)

**Outgoing:**
- Mercado Pago API (`api.mercadopago.com` via SDK): charges, preapprovals, invoices
- PayPal REST API (`api-m.paypal.com` or sandbox): orders, captures, subscriptions
- Resend API: email batches
- Brevo API (`api.brevo.com/v3/smtp/email`): fallback email
- Correo Argentino MiCorreo API: tokens, quotes, branches
- Anthropic API: translation requests
- Google OAuth token endpoint and Sheets REST API (read-only)
- Cloudflare R2 S3 endpoint (cache reads and writes)
- Supabase REST/Storage and Management API (`api.supabase.com`)
- Microsoft Clarity (`*.clarity.ms`, via the proxy route)

---

*Integration audit: 2026-11-08*
