---
last_mapped_commit: 6f52dfd
---

# Codebase Structure

**Analysis Date:** 2026-11-08

## Directory Layout

```
mundialdecollage/
├── app/                        # Next.js App Router: pages, layouts, route handlers, metadata routes
│   ├── [locale]/               # Locale segment (9 locales), filled in by proxy.ts
│   │   ├── layout.tsx          # <html>, fonts, I18nProvider, analytics
│   │   ├── opengraph-image.tsx # Site-wide link preview (ISR 3600 s)
│   │   ├── icon.png, apple-icon.png
│   │   └── (site)/             # Every page of the site
│   │       ├── layout.tsx      # ObraModalProvider + RouteTransition
│   │       ├── page.tsx        # Home (force-dynamic; anon copy in anon/)
│   │       ├── anon/           # Prebuilt copies of STATIC_PAGES (never edit by hand to diverge)
│   │       ├── admin/          # Admin panel (layout gates on ADMIN_EMAILS)
│   │       ├── obras/[slug]/   # Obra page, share image, certificate, history
│   │       ├── artistas/[slug]/
│   │       ├── galeria-3d/     # 3D gallery entry (signed in)
│   │       ├── club/           # Club map and /club/[slug] galleries
│   │       ├── mi-galeria/     # Artist's own gallery and editor
│   │       ├── onboarding/     # Artist sign-up and obra upload
│   │       ├── jurado/         # Jury scoring
│   │       ├── tienda/         # Store and subscriptions
│   │       ├── taller/         # Workshop registration
│   │       ├── donar/          # Donations
│   │       ├── revista/        # Magazine
│   │       ├── museomar/       # MAR museum page
│   │       ├── ar/[slug]/      # AR viewer and print cards
│   │       ├── notificaciones/ # Notification list
│   │       ├── auth/callback/  # Google OAuth code exchange
│   │       ├── partners/, politica-de-privacidad/, terminos-y-condiciones/, aviso/, edicion-2026/, gracias/
│   │       └── [...missing]/   # Catch-all → notFound()
│   ├── api/                    # Route handlers (29 route.ts)
│   │   ├── cron/               # Vercel Cron jobs (registro, exhibition, campanas, certificados, infra)
│   │   ├── mercadopago/, paypal/, resend/, brevo/   # Webhooks and payment endpoints
│   │   ├── img/                # Photo resizer for next/image
│   │   ├── obras/, artworks/, artistas/, club/, gallery/, shipping/, stamps/, track/, unsubscribe/
│   ├── monitoring/[...path]/   # Clarity proxy (legacy tabs)
│   ├── globals.css
│   ├── sitemap.ts, robots.ts   # Generated metadata routes
│   └── *.test.ts               # robots.test.ts
├── components/                 # React components (client and server)
│   ├── ui/                     # Primitives: button, dialog, skeleton, call-chip, country-select
│   ├── admin/                  # Admin widgets, admin-sections.ts (nav), stats/ (charts)
│   ├── gallery/                # 3D gallery (Three.js / R3F), one folder per feature
│   ├── club/                   # Club map, samples, houses on the home and /club
│   ├── ar/                     # AR viewer
│   ├── auth/                   # Google sign-in and sign-out buttons
│   ├── notifications/          # Bell, panel, list
│   └── *.tsx                   # Site sections and widgets (hero, footer, map, store, share, track …)
├── lib/                        # Domain logic and services (304 files)
│   ├── supabase/               # config.ts, server.ts, public.ts, admin.ts, client.ts
│   ├── i18n/                   # locales.ts, server.ts, client.tsx, format.ts, messages/
│   ├── payments/               # provider.ts, apply.ts, purchases.ts, providers/, paypal/
│   ├── mail/                   # index.ts, transports.ts, events.ts, webhook.ts
│   ├── notifications/          # repository.ts, server.ts, registry.ts, state.ts, time.ts
│   ├── ar/                     # AR targets, pieces, print cards (PDF)
│   ├── data/                   # Geography for the map: world-countries-110m.json, malvinas-50m.json
│   └── *.ts / *.tsx            # One module per concept, usually with *.test.ts beside it
├── data/                       # artworks.ts (Artwork type, gallery slots), artworks.test.ts
├── proxy.ts                    # Request edge: locale, anon rewrite, session refresh
├── proxy.test.ts               # Matcher and rewrite tests
├── supabase/
│   └── migrations/             # 107 SQL migrations, YYYYMMDDHHMMSS_name.sql
├── scripts/                    # Operational CLIs and DB test harnesses (see below)
│   ├── pglite/                 # Embedded-Postgres harness and club/registro scenarios
│   ├── avatars/                # Avatar build (build.mjs, page.ts)
│   └── apps-script/            # Registro.gs (Google Apps Script)
├── public/                     # Static files served as-is
│   ├── ar/, brand/, data/, email/, music/   # AR assets, brand images, data, mail images, tracks
│   └── *.png, *.mp4, *.mp3, *.pdf, logo*.png, mundial-de-collage.pdf
├── assets/                     # Fonts read at build (share image template hash) and by drawing code
├── docs/                       # Project docs (bases, Club, Correo, gallery notes, patrocinio)
├── .github/workflows/          # ci.yml, supabase-migrations.yml
├── .planning/codebase/         # These analysis documents
├── next.config.mjs             # Image loader, share-image template hash, redirects
├── vercel.json                 # Cron schedules; Git auto-deploy off for main
├── vitest.config.mts, vitest.setup.ts
├── eslint.config.mjs, tsconfig.json, postcss.config.mjs, components.json
├── AGENTS.md, CLAUDE.md, README.md, ROADMAP.md
└── package.json
```

Local, not in git (see Special Directories): `.local/`, `output/`, `.codex/`, `.next/`, `.vercel/`, `node_modules/`, `supabase/.temp/`, `.claude/settings.local.json`.

## Directory Purposes

**`app/[locale]/(site)/`:**
- Purpose: every page the visitor sees, in one tree the proxy rewrites into.
- Contains: 61 `page.tsx`, `loading.tsx`, `error.tsx` and `not-found.tsx` files, `actions.ts` (Server Actions), route handlers, `opengraph-image.tsx`.
- Key files: `app/[locale]/(site)/layout.tsx`, `app/[locale]/(site)/page.tsx`, `app/[locale]/(site)/not-found.tsx`, `app/[locale]/(site)/error.tsx`.

**`app/[locale]/(site)/anon/`:**
- Purpose: prebuilt copies of the public pages in `lib/static-pages.ts`, served from the CDN to visitors with nothing personal.
- Contains: 12 `page.tsx` files, plus `anon/obras/[slug]/opengraph-image.tsx` and `loading.tsx`. Each file calls `renderAsAnonymous()` and re-exports the real page (`../../club/page`, `../../galeria-3d/page`, and so on).
- Key files: `anon/page.tsx` (home), `anon/obras/[slug]/page.tsx`, `anon/galeria-3d/page.tsx`, `anon/club/[slug]/page.tsx`.
- Rule: a new public page gets a copy here, and the copy keeps the same path shape as its real page.

**`app/[locale]/(site)/admin/`:**
- Purpose: operations panel for the organizers.
- Contains: `layout.tsx` (access gate), `page.tsx` (redirects to `estadisticas`), one folder per section: `campanas`, `club`, `comentarios`, `contactos`, `convocatoria`, `envios`, `estadisticas`, `inscripciones`, `jurado`, `muro`, `obras`, `pagos`, `plantillas`, `revista`, `tienda` (with `errores`). Each has `page.tsx`, often `actions.ts` and `loading.tsx`.
- Key files: `admin/layout.tsx`, `admin/obras/actions.ts`, `admin/campanas/actions.ts`, `admin/estadisticas/page.tsx`.

**`app/api/`:**
- Purpose: HTTP endpoints for webhooks, cron, client `fetch` calls and images.
- Contains: 29 `route.ts`. The proxy never runs for `/api/**` (matcher), so each route checks its own session when it needs one (`app/api/track/route.ts`, `app/api/stamps/route.ts`).
- Key files: `app/api/img/route.ts`, `app/api/cron/*/route.ts`, `app/api/mercadopago/webhook/route.ts`, `app/api/paypal/webhook/route.ts`, `app/api/resend/webhook/route.ts`, `app/api/brevo/webhook/route.ts`.

**`components/`:**
- Purpose: UI. The site sections sit at the top level; features with more than a few files get a folder.
- Contains: about 299 files. Top-level files use kebab-case (`site-header.tsx`, `obra-modal.tsx`). `components/gallery/` uses PascalCase for its entry components (`Game.tsx`, `Scene.tsx`, `GalleryAccess.tsx`, `ClubGame.tsx`) and kebab/camel names for helpers.
- Key files: `components/site-header.tsx`, `components/route-transition.tsx`, `components/obra-modal.tsx`, `components/admin/admin-sections.ts`, `components/gallery/Game.tsx`.

**`components/gallery/`:**
- Purpose: the 3D gallery and the Club's galleries.
- Contains: one folder per feature, each with a `store.ts` (zustand) where state is shared:
  - `arcade/` (cabinet and snake game), `artwork/` (frames, artwork meshes), `attention/` (raycast and dwell recorder), `camera/` (first-person camera, edge look), `club/` (Club door, host, map dialog, stamps), `graphics/` (quality settings), `interaction/`, `minimap/`, `mobile/` (touch controls), `navigation/` (pathing, pointer navigation), `passport/`, `player/` (body, jump, spawn), `preferences/`, `presence/` (Realtime), `souvenir/` (photo capture), `tutorial/`, `ui/` (HUD: passport, minimap, start screen, presence counter, artwork modal), `vinyl/` (music player and tracks), `wall/` (collage wall), `world/` (rooms, architecture, MAR museum, people, visitors).
- Top-level files: `Game.tsx` (orchestrates everything, loaded with `ssr: false`), `Scene.tsx` (R3F scene), `GalleryAccess.tsx` (sign-in gate), `ClubGame.tsx`, `themes.ts`, `venue.ts`, `fonts.ts`, `gallery-theme.module.css`.

**`lib/`:**
- Purpose: everything that is not UI or routing. About 304 files, most with a colocated `*.test.ts`.
- Subfolders:
  - `lib/supabase/`: the five Supabase clients and the config gate (see Key File Locations).
  - `lib/i18n/`: `locales.ts` (list and detection), `server.ts` (`getI18n`), `client.tsx` (`I18nProvider`, `useI18n`), `format.ts`, `messages/` (one file per locale plus `index.ts` and `client.ts`).
  - `lib/payments/`: `provider.ts` (interface), `apply.ts` (`syncPayment`), `purchases.ts`, `references.ts`, `recover.ts`, `validation.ts`, `customers.ts`, `providers/mercadopago.ts`, `providers/paypal.ts`, `paypal/` (store subscriptions: `client.ts`, `handlers.ts`, `plans.ts`), `fake-supabase.ts` (test double).
  - `lib/mail/`: `index.ts` (`sendMail`, `sendMails`), `transports.ts`, `events.ts`, `webhook.ts`.
  - `lib/notifications/`: `repository.ts`, `server.ts`, `registry.ts`, `state.ts`, `time.ts`.
  - `lib/ar/`: `pieces.ts`, `targets.ts`, `mindar.ts`, `print-cards.tsx` (PDF cards).
  - `lib/data/`: JSON geography for the map.
- Top-level modules by theme (not exhaustive):
  - Caching and images: `public-data-cache.ts`, `public-cache-tags.ts`, `share-image-cache.ts`, `artwork-share-image.tsx`, `r2.ts`, `image-src.ts`, `image-loader.ts`, `image-widths.mjs`, `downscale-image.ts`, `render-mode.ts`, `static-pages.ts`, `brand-images.mjs`.
  - Obras and galleries: `finalists.ts`, `gallery-artworks.ts`, `gallery-attention.ts`, `gallery-catalog.ts`, `gallery-identity.ts`, `obra-detail.ts`, `public-obra-neighbors.ts`, `artwork-search.ts`, `artwork-stats.ts`, `artwork-slug.ts`, `slug.ts`, `collage-wall.ts`, `exhibition-day.ts`, `call-state.ts`.
  - Registration and imports: `registro.ts`, `registro-sync.ts`, `registro-image-fingerprint.ts`, `legacy-submissions.ts`, `publish-legacy.ts`, `reuse-registro-artwork.ts`, `entries.ts`, `submissions.ts`, `google-sheets.ts`, `onboarding-*.ts`, `participants.ts`.
  - Club: `club-*.ts` (galleries, editor, map, plans, payments, subscriptions, courtesy, launch, samples, contact, next-gallery).
  - Money: `pricing.ts`, `donations.ts`, `donation-payments.ts`, `coin-pack-*.ts`, `entry-payments.ts`, `magazine*.ts`, `workshop-payments.ts`, `store.ts`, `mercadopago*.ts`, `mp-subscriptions*.ts`, `receipts.ts`, `subscription-receipts.ts`, `correo*.ts` (Correo Argentino shipping).
  - Mail and campaigns: `mail-quota.ts`, `resend.ts`, `campaign-*.ts`, `countdown-campaigns.ts`, `email-*.ts`, `system-templates.ts`, `template-audiences.ts`, `certificate-*.ts`, `exhibition-mail.ts`, `artist-digest.ts`, `supporter-welcome.ts`, `jury-mail.ts`, `shipment-notices.ts`, `mail-links.ts`.
  - Analytics and referrals: `funnel.ts`, `track.ts`, `track-server.ts`, `referral.ts`, `referral-server.ts`, `visit-source.ts`, `in-app-browser.ts`, `income.ts`, `home-stats.ts`, `country-breakdown.ts`, `chart-math.ts`, `supabase-monitor.ts`.
  - Auth and security: `admin.ts`, `safe-next.ts`, `mercadopago-signature.ts`, `resend-signature.ts`, `certificate-token.ts`, `moderation.ts`, `terms*.ts`, `terms-version.ts`.
  - Site-wide: `site.ts` (deadline, contact, sender), `utils.ts`, `cron.ts`, `stamps.ts`, `splash.ts`, `flag-svg.ts`, `paper-fabric.ts`, `phone.ts`, `name-format.ts`, `country-codes.ts`.

**`data/`:**
- Purpose: static typed data used by the gallery.
- Contains: `artworks.ts` (`Artwork` type, `GALLERY_FRAME_STYLES`, `gallerySlots`, `clubGallerySlots`), `artworks.test.ts`.

**`supabase/migrations/`:**
- Purpose: the whole database schema, RLS policies and SQL functions.
- Contains: 107 SQL files, from `20260916000000_profiles.sql` to the newest `20261029240000_club_guest_boards.sql` in this tree. Names are `YYYYMMDDHHMMSS_<topic>.sql`.
- Each migration reaches production through `.github/workflows/supabase-migrations.yml` after the checks pass on `main`.

**`scripts/`:**
- Purpose: operations run by hand, plus DB tests.
- Contains:
  - Importers and syncs (run with `node --env-file=.env.local --import ./scripts/node-project-imports.mjs scripts/<name>.mts`): `import-obras.mts`, `import-contactos.mts`, `sync-registro.mts`, `sync-contactos-sheets.mts`, `audit-contactos.mts`, `setup-multiple-artwork-campaign.mts`.
  - Asset builds: `brand-images.mjs` (WebP copies of logos), `build-bases-pdf.mts` (`public/mundial-de-collage.pdf`), `avatars/build.mjs`, `paypal-setup.mjs`.
  - Probes: `probe-mp-subscription.mjs`.
  - DB tests (run inside a rolled-back transaction): `test-club-galleries-db.mts`, `test-contact-sanitize-db.mts`, `test-legacy-publication-db.mts`, `test-optional-title-db.mts`, `test-registro-*-db.mts`, `test-relink-orphans-db.mts`.
  - Unit tests: `registro.test.mts`, `registro-image-fingerprint.test.mts`, `apps-script-registro.test.mts`.
  - `pglite/`: `harness.mjs` applies every migration to PGlite in order; `club-*.mjs` and `store-regression.mjs` are scenario scripts.
  - `apps-script/Registro.gs`: the Google Apps Script bound to the registration sheet.
  - `node-project-imports.mjs`: Node loader hook that resolves the `@/` alias for scripts.

**`public/`:**
- Purpose: files served at fixed URLs.
- Contains: `logo*.png`, `wordmark.png`, `banner-mundial.png`, `header.png`/`header.mp4`, `cancion.mp3`, `mundial-de-collage.pdf`, `tienda-productos.webp`, `brand/` (WebP brand images from `scripts/brand-images.mjs`), `ar/` (AR markers and assets), `data/` (`argentina/`, `tarjeta-marca.png`), `email/` (images used in mail), `music/` (gallery tracks).

**`assets/`:**
- Purpose: font files (`Anton-Regular.ttf`, `Oswald-Cyrillic-700.woff`, EB Garamond WOFF) read by the drawing code and by `next.config.mjs` (hash of the share-image template).

**`docs/`:**
- Purpose: project notes read by humans: `bases/` (contest rules HTML and fonts, input for the PDF), `patrocinio/` (sponsorship material), `club-del-mundial-galerias-virtuales.md`, `correo-argentino.md`, `galeria-atencion.md`, `gallery-graphics.md`, `mar-gallery.md`, `vercel-performance-review-2026-10-10.md`.

**`.github/workflows/`:**
- `ci.yml`: lint, typegen, `tsc --noEmit`, tests, build; then migrations and the Vercel deploy hook on `main`.
- `supabase-migrations.yml`: `supabase db push --remote`, reusable and manually runnable.

## Special Directories

**`.next/`:**
- Purpose: Next build output and cache.
- Generated: Yes. Committed: No (`.gitignore`).

**`.vercel/`:**
- Purpose: Vercel project link.
- Generated: Yes. Committed: No (`.gitignore`).

**`.local/`:**
- Purpose: private snapshots of the Registro sheet and contact backups used by the importers (`registro-backups/`, `contact-backups/`, `duplicate-audit/`, `manual-fixes/`, `contacts-sanitize/`).
- Generated: Yes, by scripts and cron. Committed: No (`/.local/` in `.gitignore`).

**`output/`:**
- Purpose: generated marketing images (carousels, covers, `imagegen/`) and PDFs (`output/pdf/`).
- Generated: Yes. Committed: No (`/output/` in `.gitignore`). About 167 MB locally.

**`tmp/`:**
- Purpose: scratch files (`tmp/pdfs/`).
- Generated: Yes. Committed: Not in `.gitignore`; check before staging.

**`generated_images/`, `Claude outputs/`:**
- Purpose: empty output folders from earlier tooling. Not referenced by code. Not in `.gitignore`.

**`propuestas/`:**
- Purpose: proposal material (`tienda-suscripciones.html`).
- Generated: No. Committed: Yes (check `git ls-files propuestas`).

**`.claude/`:**
- Purpose: Claude Code project settings. `worktrees/` holds full checkouts of other branches; `vitest.config.mts` excludes `.claude/**` so their tests do not run here.
- Committed: `.claude/worktrees` is local. `settings.local.json` is gitignored.

**`.codex/`:**
- Purpose: Codex local configuration (may hold a payment token). Gitignored; never read or commit.

**`supabase/.temp/`:**
- Purpose: Supabase CLI link cache (project ref, CLI version). Gitignored.

**`node_modules/`:**
- Generated: Yes. Committed: No.

## Key File Locations

**Entry Points:**
- `proxy.ts`: request edge (locale, anon rewrite, session refresh, matcher).
- `app/[locale]/layout.tsx`: root layout and `generateStaticParams` for the nine locales.
- `app/[locale]/(site)/layout.tsx`: site layout.
- `app/[locale]/(site)/page.tsx`: home.
- `app/[locale]/(site)/auth/callback/route.ts`: OAuth callback.
- `app/api/cron/*/route.ts`: scheduled jobs (times in `vercel.json`).
- `app/api/*/webhook/route.ts`: provider notifications.

**Configuration:**
- `next.config.mjs`: custom image loader, `deviceSizes`/`imageSizes` from `lib/image-widths.mjs`, Supabase Storage remote pattern, `SHARE_IMAGE_TEMPLATE` build hash, `/participantes` redirect.
- `vercel.json`: cron schedules and `git.deploymentEnabled.main = false`.
- `tsconfig.json`: `@/*` → `./*`.
- `vitest.config.mts`: `@` alias, node environment, `vitest.setup.ts` (mocks `next/root-params` and `@/lib/public-data-cache`).
- `eslint.config.mjs`: lint rules (run by CI).
- `components.json`: shadcn/ui settings.
- `postcss.config.mjs`: Tailwind v4 through `@tailwindcss/postcss`.
- `lib/site.ts`: deadline, contact address, sender, workshop copy; edit here for copy used across the site.
- `lib/admin.ts`: admin emails.
- `lib/club-launch.ts`: `CLUB_OPEN` switch.
- `lib/supabase/config.ts`, `lib/mercadopago.ts`, `lib/resend.ts`, `lib/r2.ts`: environment gates.

**Core Logic:**
- `lib/supabase/server.ts`: `createClient()`, `getCurrentUser()`.
- `lib/supabase/public.ts`, `lib/supabase/admin.ts`, `lib/supabase/client.ts`: the other Supabase clients.
- `lib/render-mode.ts`: anonymous-render flag.
- `lib/static-pages.ts`: which pages have an `anon/` copy.
- `lib/public-data-cache.ts`, `lib/public-cache-tags.ts`: cache wrappers and tags.
- `lib/share-image-cache.ts`, `lib/r2.ts`: draw-once image cache.
- `lib/cron.ts`: cron framework.
- `lib/payments/provider.ts`, `lib/payments/apply.ts`: payments.
- `lib/mail/index.ts`, `lib/mail-quota.ts`: mail.
- `lib/registro-sync.ts`, `lib/registro.ts`: sheet import.
- `lib/i18n/server.ts`, `lib/i18n/locales.ts`, `lib/i18n/messages/es.ts`: locale and Spanish source copy.
- `components/gallery/Game.tsx`, `components/gallery/Scene.tsx`: 3D gallery.
- `components/gallery/presence/protocol.ts`: Realtime message validation.

**Testing:**
- `proxy.test.ts`: matcher and rewrite rules.
- `lib/static-pages.test.ts`: every listed page has a copy that calls `renderAsAnonymous()`.
- `lib/cost-guards.test.ts`: image renderer allowlist.
- `lib/*.test.ts`, `app/**/*.test.ts(x)`, `components/**/*.test.ts(x)`, `scripts/*.test.mts`, `data/artworks.test.ts`.
- `scripts/pglite/harness.mjs` and `scripts/pglite/*.mjs`: database checks without a Supabase instance.

**Database:**
- `supabase/migrations/`: schema, RLS policies, `is_admin()`, `call_state`, `exhibition_day`, `funnel_events`, `mail_usage`, Club tables.

## Naming Conventions

**Files:**
- Next.js special files: lowercase (`page.tsx`, `layout.tsx`, `route.ts`, `actions.ts` is project convention for Server Actions, `loading.tsx`, `error.tsx`, `not-found.tsx`, `opengraph-image.tsx`).
- Library modules: kebab-case, named by concept: `club-galleries.ts`, `share-image-cache.ts`, `mail-quota.ts`, `coin-pack-payments.ts`.
- Provider or client code under `lib/payments/providers/`: lowercase provider name: `mercadopago.ts`, `paypal.ts`.
- Tests: colocated, `<name>.test.ts` or `.test.tsx`. Scripts tests `*.test.mts`; DB checks `test-<area>-db.mts`.
- Migrations: `YYYYMMDDHHMMSS_<snake_case_topic>.sql`.
- Scripts: kebab-case `.mts` or `.mjs`.

**Directories:**
- Route segments: lowercase Spanish words, kebab-case when multi-word (`galeria-3d`, `mi-galeria`, `politica-de-privacidad`, `terminos-y-condiciones`). Dynamic segments `[slug]`, `[id]`, `[...missing]`, `[...path]`.
- Feature folders in `components/gallery/`: lowercase single words (`arcade`, `presence`, `world`).
- Locale folder: `[locale]` (never hardcoded in code, use `getI18n()`).

**Identifiers:**
- Components: PascalCase exports (`GalleryAccess`, `ClubGame`, `ObraModalProvider`).
- Functions and values: camelCase (`getCurrentUser`, `renderAsAnonymous`, `cachedShareImage`).
- Constants: UPPER_SNAKE (`STATIC_PAGES`, `REFERRAL_COOKIE`, `ADMIN_EMAILS`, `IMAGE_RENDERERS`, `LOCALE_COOKIE`).
- Server Actions: verbs in camelCase, named after the action (`importLegacySubmissions`, `refreshPublicData`); files named `actions.ts` in the route folder.
- Cache tags: `public-data:<key>`, `artwork:<hash>`, `artist:<id>`, `club-gallery:<hash>`.
- Locale codes: lowercase ISO 639-1 (`es`, `en`, `pt`, `it`, `fr`, `de`, `ru`, `pl`, `id`).

**Copy and messages:**
- User-facing strings live in `lib/i18n/messages/<locale>.ts` (Spanish is the source). Do not hardcode strings in components, except where a page is Spanish-only (admin panel labels are in Spanish directly in admin files).

## Where to Add New Code

**A new public page:**
1. Page: `app/[locale]/(site)/<route>/page.tsx`. Read session with `getCurrentUser()`, locale with `getI18n()`. Use `export const dynamic = 'force-dynamic'` only when the data really changes per request; otherwise prefer `revalidate`.
2. If it is public, personal-free and should be served from the CDN: add the path to `STATIC_PAGES` in `lib/static-pages.ts`, create `app/[locale]/(site)/anon/<route>/page.tsx` that calls `renderAsAnonymous()` and re-exports the page, with `export const revalidate`. `lib/static-pages.test.ts` checks it.
3. Keep the page out of the proxy matcher only if it never reads the session (`proxy.test.ts`).
4. Strings: `lib/i18n/messages/es.ts` and the other locale files (`lib/i18n/messages.test.ts`).

**A new admin section:**
- Page: `app/[locale]/(site)/admin/<name>/page.tsx` (+ `loading.tsx`), writes in `app/[locale]/(site)/admin/<name>/actions.ts`.
- Each Server Action that uses `createAdminClient()` must check admin-ness first (`assertIsAdmin` pattern in `admin/obras/actions.ts`).
- Navigation: add an entry to `adminSections` in `components/admin/admin-sections.ts`.
- Components: `components/admin/<name>.tsx`; charts in `components/admin/stats/`.

**A new Server Action:**
- Co-locate in the page folder as `actions.ts` with `'use server'` at the top. Read the user with `createClient()` and `getUser()` (not `getCurrentUser()`, which is not memoized there). Refresh public data after writes with `refreshArtworkData()`, `refreshPublicData()` or `refreshClubGallery()` from `lib/public-data-cache.ts`.

**A new API route:**
- `app/api/<area>/<name>/route.ts`. The proxy skips `/api/**`, so the route handles its own session and origin checks (see `app/api/gallery/attention/route.ts`). Set `Cache-Control` with `s-maxage` if the response is the same for everyone (see `app/api/img/route.ts`).
- Webhooks: verify the signature with a helper beside the route (`lib/mercadopago-signature.ts` pattern), answer 200 for topics you do not need, and add a `route.test.ts` (see `app/api/mercadopago/webhook/route.test.ts`).

**A new cron job:**
- Route: `app/api/cron/<name>/route.ts` using `cronRoute()` and `runCronJobs()` from `lib/cron.ts`.
- Schedule: add to `vercel.json` `crons`.
- Logic: `lib/<name>.ts` with a colocated test. Use `dryRun` for previews.

**A new server-side image renderer:**
- Cache its output first (`cachedShareImage()` from `lib/share-image-cache.ts`, or ISR). Then add the file to `IMAGE_RENDERERS` in `lib/cost-guards.test.ts`, with how it avoids redrawing. The test fails until it is listed.

**A new payment purchase kind:**
- Logic: `lib/<kind>-payments.ts` that returns a purchase strategy, registered in `lib/payments/apply.ts`. Provider-specific code stays in `lib/payments/providers/`.
- Tests beside it (see `lib/entry-payments.ts` with `lib/payments/apply.ts` tests in `lib/payments/apply.test.ts`).

**A new mail template or campaign:**
- Template: `lib/system-templates.ts` (`ensureSystemTemplate`, `renderSystemEmail`). Sending: `lib/mail/index.ts` (`transactional` or `bulk`). Audience: `lib/campaign-audience.ts`, `lib/template-audiences.ts`. Translations: `lib/email-translation.ts`.

**A new database change:**
- Migration: `supabase/migrations/<YYYYMMDDHHMMSS>_<topic>.sql`. The migration reaches production when CI passes on `main`, so test it first with `scripts/pglite/harness.mjs` (`npm install --no-save @electric-sql/pglite`) and, if it has invariants, a rolled-back check script like `scripts/test-club-galleries-db.mts`.
- Access rules: RLS in the same migration. Admin rules use `is_admin()`.

**A new gallery feature (3D):**
- Folder: `components/gallery/<feature>/` with `store.ts` (zustand) and the component. Mount it from `components/gallery/Game.tsx`. Keep Three.js code behind `Scene.tsx` (client-only dynamic import).
- Messages to other visitors: validate in `components/gallery/presence/protocol.ts` style (anyone can publish on the channel).
- Club-only behavior: `components/gallery/club/`.

**A new Club feature:**
- Data and rules: `lib/club-<topic>.ts` with a `*.test.ts`. Actions: `app/[locale]/(site)/mi-galeria/editar/actions.ts` (owner) or `app/[locale]/(site)/admin/club/actions.ts` (admin). UI: `components/club/*` (site) or `components/gallery/club/*` (inside the gallery).

**A new shared utility:**
- `lib/<concept>.ts` for pure logic (framework-free if the Node scripts need it: no `@/` imports), with `lib/<concept>.test.ts` next to it.

**A new React component:**
- Primitive (no domain logic): `components/ui/<name>.tsx`.
- Site section: `components/<name>.tsx` (kebab-case).
- Feature: `components/<feature>/<Name>.tsx` in a folder.

**A new script:**
- `scripts/<name>.mts` (TypeScript, runs with `node --env-file=.env.local --import ./scripts/node-project-imports.mjs`). Read-only audits say so in the header. DB checks run inside `BEGIN … ROLLBACK`.

**Tests:**
- Colocate `<module>.test.ts` next to the module. For UI, `*.test.tsx` beside the component. Route tests mock Supabase with `vi.mock('@supabase/ssr', …)` as in `proxy.test.ts`.

## Special Directories Rules

- **Never commit:** `.local/`, `output/`, `.codex/`, `.env*`, `supabase/.temp/`, `.claude/settings.local.json`.
- **Before staging:** check `tmp/`, `generated_images/`, `Claude outputs/`, `propuestas/` (not gitignored).
- **Keep in sync:** `ADMIN_EMAILS` in `lib/admin.ts` with `is_admin()` in the migrations; `lib/exhibition-day.ts` with `exhibition_day()` in its migration; `lib/club-map.ts` rounding with the Club migration.

---

*Structure analysis: 2026-11-08*
