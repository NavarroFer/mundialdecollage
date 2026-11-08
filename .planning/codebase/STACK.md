---
last_mapped_commit: 6f52dfd
---

# Technology Stack

**Analysis Date:** 2026-11-08

## Languages

**Primary:**
- TypeScript 5.7.3 (`typescript` devDependency, strict mode in `tsconfig.json`) - all application code in `app/`, `components/`, `lib/`, `proxy.ts`, and tests (`*.test.ts`, `*.test.tsx`)
- TSX/React 19 - UI components in `components/` and route pages under `app/[locale]/(site)/`

**Secondary:**
- JavaScript (ESM `.mjs`/`.mts`) - Config and scripts: `next.config.mjs`, `eslint.config.mjs`, `postcss.config.mjs`, `lib/image-widths.mjs`, `lib/brand-images.mjs`, `scripts/*.mts`, `scripts/*.mjs`, `scripts/pglite/harness.mjs`
- SQL (PostgreSQL dialect) - Supabase schema, RLS and grants in `supabase/migrations/` (106 files, `20260916000000_profiles.sql` through `20261029240000_club_guest_boards.sql`)
- Google Apps Script (JavaScript) - `scripts/apps-script/Registro.gs`
- CSS - Tailwind CSS v4 utilities plus CSS variables; `tw-animate-css` for animations
- Shell/Markdown - not production code; `README.md`, `ROADMAP.md`, `CLAUDE.md`, `AGENTS.md`

## Runtime

**Application runtime:**
- Node.js 22 - pinned only in CI (`node-version: 22` in `.github/workflows/ci.yml`). No `.nvmrc`, no `.node-version`, and no `engines` field in `package.json`.
- Production runtime: Vercel Functions. Routes that need Node APIs set `export const runtime = 'nodejs'` (e.g. `app/api/paypal/webhook/route.ts`, `app/api/paypal/return/route.ts`, `app/api/paypal/orders/route.ts`). Default is Node.
- Browser runtime: React 19 client components; 3D gallery runs in WebGL via Three.js.

**Package Manager:**
- npm (lockfile-based). `package-lock.json` present, `lockfileVersion: 3`. CI runs `npm ci`.
- Installed versions were verified against `node_modules/*/package.json`.

**Dev server:**
- `next dev` (script `dev`). `next.config.mjs` sets `allowedDevOrigins: ['*.trycloudflare.com']` so a phone can reach the dev server through a Cloudflare quick tunnel (HTTPS is needed for the camera on `/ar/[slug]`).

## Frameworks

**Core:**
- Next.js 16.3.5 (`next`) - App Router, Server Components, Route Handlers, `proxy.ts` as request middleware (replaces `middleware.ts`), `unstable_cache`/`revalidate` for data caching. See `AGENTS.md`: this is a Next.js version with breaking changes; read `node_modules/next/dist/docs/` before writing code.
- React 19.2.8 and React DOM 19.2.8 (`react`, `react-dom`)
- `next.config.mjs` customizes image loading (`images.loader: 'custom'`, `loaderFile: './lib/image-loader.ts'`), a redirect `/participantes` to `/#participantes`, and an injected build-time constant `SHARE_IMAGE_TEMPLATE` (a hash of the share-image template and its assets, used as part of the R2 cache key).

**3D / Graphics (3D gallery):**
- Three.js 0.186.0 (`three`, types `@types/three` 0.186.0)
- React Three Fiber 9.7.0 (`@react-three/fiber`)
- React Three Drei 10.7.8 (`@react-three/drei`)
- React Three Rapier 2.2.0 (`@react-three/rapier`) - physics in `components/gallery/Scene.tsx`, `components/gallery/club/ClubDoor.tsx`, `components/gallery/arcade/ArcadeCabinet.tsx`
- GSAP 3.15.0 (`gsap`) - timeline animations
- Motion 13.4.4 (`motion`) - React animation library

**Maps and data viz:**
- react-simple-maps 5.0.5 (`react-simple-maps`) - world map (`lib/world-shapes.ts`, `lib/club-map.ts`)
- `geojson` types used by map code
- country-flag-icons 1.6.20 (`country-flag-icons`) - flag SVGs (`lib/flag-svg.ts`)

**Styling and UI:**
- Tailwind CSS 4.3.3 installed (`tailwindcss` declared `^4.2.0`) with `@tailwindcss/postcss`; PostCSS 8.5 (`postcss.config.mjs`)
- `tw-animate-css` 1.3.3 (devDependency)
- Radix UI Dialog 1.1.23 (`@radix-ui/react-dialog`) and Slot 1.2.4 (`@radix-ui/react-slot`)
- class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.3.x (utility trio)
- Lucide React 0.564.0 (`lucide-react`) - icons used across components
- shadcn/ui configuration in `components.json`
- Drag and drop: `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2

**State:**
- zustand 5.0.15 (`zustand`) - client state stores

**Testing:**
- Vitest 5.0.1 (`vitest`) - config `vitest.config.mts`, setup `vitest.setup.ts`. Environment `node`, `@/` alias, excludes `.claude/**` (agent worktrees). Test files live next to source (e.g. `lib/cost-guards.test.ts`, `proxy.test.ts`, `lib/payments/paypal/handlers.test.ts`).
- PGlite (`@electric-sql/pglite`) - embedded Postgres used by the SQL harness in `scripts/pglite/harness.mjs` and `scripts/test-*-db.mts` (no local DB exists; migration SQL is tested here).
- Vite 7.1.12 (`vite`) - devDependency; Vitest runs on the Vite toolchain.
- Playwright Core 1.64.1 (`playwright-core`) - driven by `scripts/build-bases-pdf.mts` and `scripts/avatars/build.mjs`; `CHROME_PATH` env selects a system Chrome.

**Build/Dev:**
- `next build` (script `build`) - production build; CI runs it without Supabase or Mercado Pago env vars so the "not configured" paths are exercised.
- `next start` (script `start`)
- `npx next typegen` - run in CI before type-checking (generates `.next/types`)
- TypeScript 5.7.3 - `tsc --noEmit` in CI; `tsconfig.json` targets ES6, `moduleResolution: bundler`, `jsx: react-jsx`, path alias `@/*` to `./*`
- ESLint 9.39.5 (`eslint`) with `eslint-config-next` 16.3.5 `core-web-vitals` preset (`eslint.config.mjs`); ignores `.claude/**`
- esbuild 0.25.12 (devDependency) - used by build scripts under `scripts/`
- `@gltf-transform/cli` 4.5.1 (devDependency) - glTF/GLB asset processing for the 3D gallery
- `supabase` CLI - run in CI only (see `supabase-migrations.yml`); not in `package.json`

## Image Processing

- sharp 0.35.4 (`sharp`) - server-side resize/convert in `app/api/img/route.ts`, `lib/artwork-share-image.tsx`, `lib/certificate.tsx`, `lib/ar/print-cards.tsx`, `lib/legacy-submissions.ts`, `lib/registro-image-fingerprint.ts`
- satori (via `next/og` `ImageResponse`) - draws share images; only allowed in cached paths (see `lib/cost-guards.test.ts`)
- html-to-image 1.11.13 (`html-to-image`) - client-side DOM-to-image export
- pdf-lib 1.17.1 (`pdf-lib`) - PDF generation (`lib/certificate.tsx`, `lib/ar/print-cards.tsx`, `scripts/build-bases-pdf.mts`)
- qrcode 1.5.4 (`qrcode`) - QR codes (`lib/ar/`, certificates)
- Image delivery: no Vercel Image Optimization. `lib/image-loader.ts` routes images through `app/api/img`, which caches sources and sizes in Cloudflare R2 (`lib/r2.ts`) so Supabase Storage egress is not repeated.

## Key Dependencies

**Critical (external services):**
- `@supabase/supabase-js` 2.116.0 - Postgres/Auth/Storage/Realtime client (`lib/supabase/*.ts`)
- `@supabase/ssr` 0.12.7 - Supabase session cookies in `proxy.ts` and server components (`lib/supabase/server.ts`)
- `mercadopago` 3.6.1 - Mercado Pago SDK (`lib/mercadopago.ts`, `lib/mp-subscriptions.ts`) for ARS payments and preapproval subscriptions
- `@paypal/react-paypal-js` 10.5.2 - PayPal JS SDK in the browser; server calls are plain `fetch` (`lib/payments/paypal/client.ts`)
- `resend` 6.28.1 - transactional email (`lib/resend.ts`)
- `@anthropic-ai/sdk` 0.128.0 - email translation (`lib/email-translator.ts`, model `claude-sonnet-5`)
- `aws4fetch` 1.0.20 - signs S3-API requests to Cloudflare R2 without the AWS SDK (`lib/r2.ts`)
- `@vercel/analytics` 2.0.1 and `@vercel/speed-insights` 2.0.0 - mounted via `components/vercel-analytics.tsx`

**Domain logic:**
- zod 4.6.5 - schema validation for inputs
- `country-flag-icons`, `react-simple-maps`, `qrcode`, `pdf-lib` - see Frameworks/Image Processing above

**Infrastructure:**
- Next.js built-in fetch cache, `unstable_cache`, `revalidate` (no Redis, no external cache)
- Vercel Cron (declared in `vercel.json`)

**Deliberately not used:**
- No `googleapis` SDK: `lib/google-sheets.ts` signs a JWT with `node:crypto` and calls the Sheets REST API directly.
- No AWS SDK: `aws4fetch` is used for R2.
- No Vercel Image Optimization (the `images.loader` is custom).

## Configuration

**Environment variables (names only - values are never stored in the repo):**
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_USAGE_ALERT_TOKEN` (Supabase Management API token for usage checks, `lib/supabase-monitor.ts`)
- Site: `NEXT_PUBLIC_SITE_URL`, `BRAND_NAME`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `NODE_ENV`
- Feature flags: `CLUB_OPEN` (paid club galleries), `NEXT_PUBLIC_GALLERY_LIVE` and `NEXT_PUBLIC_HOME_LIVE` (Realtime kill switches; `off` disables), `NEXT_PUBLIC_GALLERY_ASSETS_URL` (CDN base for 3D gallery people/assets; unset in local dev)
- Payments: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` (`live` selects production API), `PAYPAL_WEBHOOK_ID`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_PLAN_ID_CLUB_MONTHLY`, `PAYPAL_PLAN_ID_CLUB_ANNUAL`, `PAYPAL_PLAN_ID_SOCIO_PREMIUM`, `PAYPAL_PLAN_ID_MIEMBRO`, `PAYPAL_PLAN_ID_INICIAL`
- Email: `RESEND_API_KEY`, `RESEND_DOMAIN_API_KEY` (full-access key for domain management), `RESEND_WEBHOOK_SECRET`, `BREVO_API_KEY`, `BREVO_WEBHOOK_SECRET`, `REGISTRO_NOTIFY_EMAILS`
- Storage cache: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (all four must be set or `imageStore()` returns null and images resize from Storage)
- Shipping (Correo Argentino): `CORREO_API_USER`, `CORREO_API_PASSWORD`, `CORREO_CUSTOMER_ID`, `CORREO_API_ENV` (`test` selects the sandbox host), `CORREO_ORIGIN_POSTAL_CODE`, `CORREO_PACKAGES_JSON`, `CORREO_SHIPPING_RATE_MODE`, `CORREO_FLAT_SHIPPING_FEE`
- Google: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (escaped `\n` is restored in code), `REGISTRO_SHEET_ID`
- AI: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`
- Cron and certificates: `CRON_SECRET` (Bearer token checked by `lib/cron.ts`), `CERTIFICATE_SECRET` (`lib/certificate-token.ts`)
- Build-time: `SHARE_IMAGE_TEMPLATE` (generated by `next.config.mjs`, not set by hand)
- Tooling: `CHROME_PATH` (Playwright scripts)
- CI-only secrets (GitHub Actions): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_DEPLOY_HOOK_URL`

**Env files:**
- `.env.local` exists at the repo root (local secrets, git-ignored). Its contents are not recorded in this document.
- Vercel holds production/preview env vars; the deploy hook URL and Supabase CI tokens live in GitHub Actions secrets.

**Build and config files:**
- `next.config.mjs` - image loader, redirects, `allowedDevOrigins`, `SHARE_IMAGE_TEMPLATE` hash
- `tsconfig.json` - strict TypeScript, `@/*` alias, `next` plugin
- `eslint.config.mjs` - `eslint-config-next/core-web-vitals`
- `postcss.config.mjs` - `@tailwindcss/postcss`
- `vitest.config.mts` and `vitest.setup.ts` - test environment, mocks for `next/root-params` and `@/lib/public-data-cache`
- `vercel.json` - `git.deploymentEnabled.main: false` (no auto-deploy from main) and five cron jobs
- `components.json` - shadcn/ui settings
- `.vercel/project.json` - Vercel project link (project `mundialdecollage`)
- `supabase/` - migrations only; there is no `supabase/config.toml` in the repo

**Internationalization:**
- 9 locales: `es` (default), `en`, `pt`, `it`, `fr`, `de`, `ru`, `pl`, `id` (`lib/i18n/locales.ts`)
- Messages: one file per locale in `lib/i18n/messages/*.ts` (`index.ts`, `client.tsx`, `server.ts` and `format.ts` in `lib/i18n/`)
- Locale resolution: cookie `mdc-locale`, `Accept-Language`, `x-vercel-ip-country` (`proxy.ts`, `lib/i18n/locales.ts`)
- Pages live under `app/[locale]/`; `proxy.ts` rewrites requests to `/<locale>/...` and to `/<locale>/anon/...` for public static pages

**Working tree note:** At the time of mapping, `lib/i18n/messages/*.ts` and some `app/[locale]/(site)/` files had uncommitted edits; the locale list above is from the code, not from those edits.

## Platform Requirements

**Development:**
- Node.js 22 (match CI)
- npm with the committed `package-lock.json`
- Optional: Cloudflare Tunnel (`*.trycloudflare.com`) for HTTPS testing on phones
- Optional: system Chrome for Playwright scripts (`CHROME_PATH`)

**Production:**
- Vercel (project `mundialdecollage`), Hobby plan. CPU budget is tight: 4 hours of Active CPU per 30 days for the whole team (see `CLAUDE.md`). Production deploys are triggered by a Vercel deploy hook from GitHub Actions, not by Vercel's Git integration.
- Supabase project (Postgres, Auth, Storage, Realtime) - production schema applied by CI with `supabase db push --remote`
- Cloudflare R2 bucket for image cache (optional in code; required for R2 caching)
- Cron: five Vercel cron jobs in `vercel.json`:
  - `/api/cron/registro` every 2 hours (`0 */2 * * *`)
  - `/api/cron/exhibition` daily 12:05 UTC (`5 12 * * *`)
  - `/api/cron/campanas` daily 12:10 UTC (`10 12 * * *`)
  - `/api/cron/certificados` daily 00:15 UTC (`15 0 * * *`)
  - `/api/cron/infra` daily 12:20 UTC (`20 12 * * *`)

---

*Stack analysis: 2026-11-08*
