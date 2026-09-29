# External Integrations

**Analysis Date:** 2026-09-29

## APIs & External Services

**Payment Processing:**
- MercadoPago - Collects payments for workshop registrations and artwork postulation fees
  - SDK: `mercadopago` v3.6.1
  - Auth: `MERCADOPAGO_ACCESS_TOKEN` (env var)
  - Webhook: `POST /api/mercadopago/webhook` (`app/api/mercadopago/webhook/route.ts`)
  - Signature verification: `MERCADOPAGO_WEBHOOK_SECRET` (env var, optional until webhook registered in dashboard)
  - Integration: `lib/mercadopago.ts` (config), `lib/mercadopago-signature.ts` (webhook validation), `lib/entry-payments.ts` (payment application)

**Email Delivery:**
- Resend - Sends transactional and campaign emails
  - SDK: `resend` v6.28.1
  - Sending Auth: `RESEND_API_KEY` (restricted to sending only)
  - Domain Management Auth: `RESEND_DOMAIN_API_KEY` (full access, required for domain verification and tracking configuration)
  - Webhook: `POST /api/resend/webhook` (`app/api/resend/webhook/route.ts`)
  - Webhook signature: `RESEND_WEBHOOK_SECRET` (env var)
  - Batch size limit: 100 emails per request
  - Domain configuration: validated from `RESEND_DOMAIN_API_KEY` credentials for email verification and click/open tracking status
  - Integration: `lib/resend.ts` (client creation, domain status checks), `lib/email-translator.ts` (email translation integration)

**AI/Translation:**
- Anthropic Claude API - Translates email content into 8 languages (English, Portuguese, Italian, French, German, Russian, Polish, Indonesian)
  - SDK: `@anthropic-ai/sdk` v0.128.0
  - Model: `claude-sonnet-5` (cost-optimized for short email texts)
  - Auth: `ANTHROPIC_API_KEY` (env var)
  - Workspace: `ANTHROPIC_WORKSPACE_ID` (optional, for workspace-scoped keys)
  - Feature: Structured output with JSON schema validation
  - Integration: `lib/email-translator.ts` (translation orchestration with parallel language requests)

**Data Source:**
- Google Sheets - Registro (registration form) data source with Drive smart chip links for artwork
  - Auth: Service account with JWT-based authentication
  - Credentials: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (env vars)
  - Scope: Sheets read-only access
  - API: Google Sheets v4 REST (no SDK, direct fetch with Bearer token)
  - Sheet data format: Reads A:F columns (includes artwork titles, Instagram handles, Drive file links)
  - Integration: `lib/google-sheets.ts` (JWT token generation, sheet grid reading with Drive smart chip link extraction)
  - Sheet ID: `REGISTRO_SHEET_ID` (env var, sheet name passed as parameter)

**Maps:**
- React Simple Maps - World map for participant distribution visualization
  - Package: `react-simple-maps` v5.0.5
  - Data: Geographic participant data from Supabase, rendered on OpenStreetMap-based topology

## Data Storage

**Databases:**
- Supabase PostgreSQL - Primary application database (auth, profiles, artworks, registrations, payments, campaigns)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, client-side)
  - Admin Connection: `SUPABASE_SERVICE_ROLE_KEY` (server-side, full admin access)
  - Client Libraries: 
    - Browser: `@supabase/supabase-js` v2.116.0
    - Server: `@supabase/ssr` v0.12.7 (handles cookie-based session management)
  - Schema: Migrations in `supabase/migrations/` include tables for profiles, workshop registrations, artwork submissions, admin mailing, payment records
  - Tables: `profiles`, `workshop_registrations`, `artworks`, `admin_mailing`, and others
  - Auth: Supabase Auth with session cookies (managed by `@supabase/ssr`)
  - Integration points:
    - Server: `lib/supabase/server.ts` (createServerClient)
    - Admin: `lib/supabase/admin.ts` (createAdminClient)
    - Public: `lib/supabase/public.ts` (for auth state checks)

**File Storage:**
- Supabase Storage - Artwork images and PDFs
  - Host: `*.supabase.co/storage/v1/object/public/` (public bucket)
  - Next.js Image Optimization: Disabled (`unoptimized: true` in next.config.mjs) — images resized on upload
  - Remote Pattern: Supabase Storage URLs allowed in Next.js Image component (`remotePatterns` in next.config.mjs)
  - Buckets: Implied buckets for artworks and storage
  - Bucket limits: Configured via migrations (`20260918010000_artworks_bucket_limits.sql`)

**Caching:**
- None explicitly configured — relies on HTTP caching headers

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Custom authentication with email and password
  - Implementation: Server-side session management via cookies (`@supabase/ssr`)
  - Scope: User profiles, workshop registrations, admin access
  - Session refresh: Handled by middleware (inferred from `@supabase/ssr` middleware pattern)
  - No third-party OAuth providers configured

## Monitoring & Observability

**Error Tracking:**
- None explicitly configured (no Sentry, Rollbar, etc.)
- Console logging present in webhook handlers and API routes for debugging

**Logs:**
- Vercel deployment logs (default Next.js on Vercel)
- Console logs in API routes and webhooks (e.g., MercadoPago webhook signature validation errors)
- No centralized logging service configured

**Analytics & Session Recording:**
- Vercel Web Analytics (`@vercel/analytics` v2.0.1)
  - Tracks: Page visits, page views (without cookies)
  - Integration: `components/vercel-analytics.tsx`
  - Exclusion: `/admin` paths excluded to avoid counting admin user activity
  
- Microsoft Clarity (session recording and heatmaps)
  - Project ID: `NEXT_PUBLIC_CLARITY_PROJECT_ID` (env var)
  - Integration: `components/clarity.tsx` (injected via Script tag)
  - Monitoring endpoint: Proxy at `/monitoring/www.clarity.ms/tag/` (for privacy)
  - Exclusion: `/admin` paths excluded from recording

## CI/CD & Deployment

**Hosting:**
- Vercel (primary production host)
  - Deployment: Git-based (push to main branch triggers build)
  - Environment: Vercel project with production environment
  - Build cache: npm lockfile-based caching in CI
  - Production URL: Inferred from `VERCEL_PROJECT_PRODUCTION_URL` env var

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`)
  - Runs on: Pushes to main branch and all pull requests
  - Steps:
    1. Checkout code
    2. Setup Node 22 with npm cache
    3. Install dependencies (`npm ci`)
    4. Lint with ESLint (`npm run lint`)
    5. Type check with TypeScript (`npx tsc --noEmit`)
    6. Run tests (`npm test` / Vitest)
    7. Build (`npm run build`)
  - No integration credentials in CI (Supabase, MercadoPago, etc. omitted intentionally to test "unconfigured" mode)

**Supabase Migrations:**
- GitHub Actions (`.github/workflows/supabase-migrations.yml`)
  - Deploys Supabase schema changes automatically

**Cron Jobs:**
- Vercel Cron Jobs (configured in `vercel.json`)
  - Daily registration email job: `POST /api/cron/registro` at 12:00 UTC (0 12 * * *)
  - Daily exhibition notification job: `POST /api/cron/exhibition` at 12:05 UTC (5 12 * * *)
  - Execution: Vercel serverless functions (requires `CRON_SECRET` env var for verification)

## Environment Configuration

**Required public environment variables:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key
- `NEXT_PUBLIC_SITE_URL` - Canonical site URL (used in email links, etc.)
- `NEXT_PUBLIC_CLARITY_PROJECT_ID` - Microsoft Clarity project ID (optional, analytics disabled if missing)

**Required private environment variables:**
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin/service role key
- `ANTHROPIC_API_KEY` - Claude API key for email translation (optional, translations disabled if missing)
- `ANTHROPIC_WORKSPACE_ID` - Claude workspace ID (optional, required if using workspace-scoped keys)
- `RESEND_API_KEY` - Resend email sending key
- `RESEND_DOMAIN_API_KEY` - Resend domain management key (optional, domain verification disabled if missing)
- `RESEND_WEBHOOK_SECRET` - Webhook signature verification (optional, skipped until configured)
- `MERCADOPAGO_ACCESS_TOKEN` - MercadoPago API access token
- `MERCADOPAGO_WEBHOOK_SECRET` - MercadoPago webhook signature verification (optional, skipped until configured)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Google service account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Google service account private key (newline-escaped)
- `REGISTRO_SHEET_ID` - Google Sheets spreadsheet ID for the Registro form
- `REGISTRO_NOTIFY_EMAILS` - Comma-separated list of email addresses for registration notifications
- `CRON_SECRET` - Shared secret for Vercel Cron job verification

**Secrets location:**
- Development: `.env.local` (git-ignored)
- Staging/Production: Vercel Environment Secrets console

## Webhooks & Callbacks

**Incoming:**
- `POST /api/mercadopago/webhook` - MercadoPago payment notifications (status updates, approval, rejection)
- `POST /api/resend/webhook` - Resend email delivery events (bounces, complaints, clicks/opens if tracking enabled)

**Outgoing:**
- Email notifications via Resend to `REGISTRO_NOTIFY_EMAILS` on registration events
- No GraphQL subscriptions or WebSocket connections configured

---

*Integration audit: 2026-09-29*
