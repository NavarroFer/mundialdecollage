---
last_mapped_commit: 6f52dfd
---

# Architecture

**Analysis Date:** 2026-11-08

## System Overview

```text
                         Visitor browser / crawler
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │  Vercel CDN (per language, per path)  │
                 │  caches anon/ ISR pages, /api/img,    │
                 │  /api/obras, s-maxage responses       │
                 └───────────────┬──────────────────────┘
                     miss        │
                                 ▼
                 ┌──────────────────────────────────────┐
                 │  proxy.ts  (Vercel Function)          │
                 │  - ?lang= → cookie + redirect         │
                 │  - locale pick → /<locale>/…          │
                 │  - public page w/o session → /anon/…  │
                 │  - refreshes Supabase session cookie  │
                 └───────────────┬──────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ app/[locale]/layout.tsx  (html, fonts, I18nProvider, analytics)     │
│   app/[locale]/(site)/layout.tsx  (ObraModalProvider, RouteTransition)│
├──────────────────────┬──────────────────────┬────────────────────────┤
│ Public pages         │ Personal pages        │ Admin area             │
│ (site)/page.tsx,     │ mi-galeria, onboarding│ (site)/admin/**        │
│ anon/** copies,      │ galeria-3d, jurado,   │ layout gates on       │
│ obras, artistas,     │ tienda, notificaciones│ ADMIN_EMAILS          │
│ club, revista …      │                       │                        │
└──────────┬───────────┴──────────┬───────────┴───────────┬────────────┘
           │ Server Actions       │ Route handlers        │ Client islands
           │ (25 'use server'     │ (app/api/**, 29       │ (components/**,
           │  files)              │  route.ts files)     │  gallery 3D)
           ▼                      ▼                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Domain & service layer  (lib/**, data/artworks.ts)                   │
│  payments · mail · registro sync · club galleries · notifications    │
│  i18n · public-data cache · share images · cron · funnel tracking    │
└──────┬─────────────────┬──────────────────┬──────────────────┬───────┘
       ▼                 ▼                  ▼                  ▼
 Supabase (Postgres,  Cloudflare R2     Resend / Brevo     Mercado Pago,
 Auth, Storage,       (private cache    (mail)             PayPal, Google
 Realtime)            of photos/images)                    Sheets, Clarity
 supabase/migrations  lib/r2.ts         lib/mail/*         lib/payments/*
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Request proxy | Locale choice, `?lang=` cookie, rewrite to `/<locale>/…` or `/<locale>/anon/…`, Supabase session refresh | `proxy.ts` |
| Proxy matcher tests | Locks which paths run the proxy and where each page goes | `proxy.test.ts` |
| Root layout | `<html lang>`, fonts, blocking splash script, `I18nProvider`, analytics | `app/[locale]/layout.tsx` |
| Site layout | Wraps all public and admin pages with `ObraModalProvider` and `RouteTransition` | `app/[locale]/(site)/layout.tsx` |
| Static page registry | The list of public pages that have an `anon/` copy | `lib/static-pages.ts` |
| Anonymous render flag | Marks a render as "visitor with nothing personal" so session and referral readers answer "nobody" without touching cookies | `lib/render-mode.ts` |
| Session client | Cookie-bound Supabase client and the verified `getCurrentUser()` | `lib/supabase/server.ts` |
| Public client | Anon-key Supabase client, no cookies, for public reads | `lib/supabase/public.ts` |
| Admin client | Service-role client, bypasses RLS, server only | `lib/supabase/admin.ts` |
| Config gate | `isSupabaseConfigured` and friends; everything degrades to "not configured" instead of throwing | `lib/supabase/config.ts` |
| i18n (server) | `getI18n()` / `getLocale()` (URL segment first, then cookie, `Accept-Language`, country) | `lib/i18n/server.ts` |
| i18n (client) | `I18nProvider`, `useI18n()` | `lib/i18n/client.tsx` |
| Messages | One file per language, Spanish is the source | `lib/i18n/messages/*.ts` |
| Public data cache | `cachedPublicData()` (Next `unstable_cache`) and the refresh functions that drop it | `lib/public-data-cache.ts`, `lib/public-cache-tags.ts` |
| Share image cache | Draw-once cache of link-preview and story images in R2 | `lib/share-image-cache.ts` |
| Obra share image | Satori drawing of an obra's preview (cached through the above) | `lib/artwork-share-image.tsx` |
| Photo proxy | Resizes Supabase Storage photos with sharp, caches in R2 and the CDN | `app/api/img/route.ts`, `lib/image-loader.ts`, `lib/image-src.ts` |
| R2 store | Private S3-compatible cache (photos, sizes, share images) | `lib/r2.ts` |
| CPU cost guard | Test listing every server file that draws an image and how it avoids redrawing | `lib/cost-guards.test.ts` |
| Cron framework | Bearer-secret check, dry run, isolated jobs, admin mail on problems | `lib/cron.ts`, `app/api/cron/*/route.ts` |
| Payments (strategy) | Provider contract and the two providers | `lib/payments/provider.ts`, `lib/payments/providers/mercadopago.ts`, `lib/payments/providers/paypal.ts` |
| Payments (purchases) | What a paid reference turns into, per purchase kind | `lib/payments/apply.ts`, `lib/payments/purchases.ts`, `lib/*-payments.ts` |
| Mail | Single send path, provider choice by quota, failover | `lib/mail/index.ts`, `lib/mail/transports.ts`, `lib/mail-quota.ts` |
| Mail webhooks | Delivery events from Resend and Brevo | `app/api/resend/webhook/route.ts`, `app/api/brevo/webhook/route.ts`, `lib/mail/webhook.ts` |
| Registro sync | Google Sheets registration rows → legacy submissions → published obras | `lib/registro-sync.ts`, `lib/registro.ts`, `lib/google-sheets.ts`, `lib/publish-legacy.ts` |
| Finalists / obras data | Published obras read for pages and listings | `lib/finalists.ts`, `lib/gallery-artworks.ts`, `data/artworks.ts` |
| Call state | Whether the 1st edition call is open (cached) | `lib/call-state.ts` |
| Exhibition day | The daily lineup rotation at 09:00 Argentina time | `lib/exhibition-day.ts` |
| Club galleries | Paid artist galleries: data, map, plans, payments, subscriptions | `lib/club-*.ts`, `components/club/*`, `components/gallery/club/*` |
| 3D gallery | Three.js / R3F world, presence, attention, interaction | `components/gallery/*` (entry: `components/gallery/Game.tsx`) |
| Gallery presence | Realtime channel with validated messages | `components/gallery/presence/protocol.ts` |
| Gallery attention | Batched dwell-time reports to the server | `components/gallery/attention/*`, `app/api/gallery/attention/route.ts`, `lib/gallery-attention.ts` |
| Funnel tracking | Visit steps (gallery → sign-in → home → sign-up) batched to the server | `lib/funnel.ts`, `lib/track.ts`, `lib/track-server.ts`, `app/api/track/route.ts` |
| Referrals | Artist invitation links (`?ref=`) and crediting | `lib/referral.ts`, `lib/referral-server.ts` |
| Notifications | Bell and list, one repository for both Supabase clients | `lib/notifications/repository.ts`, `lib/notifications/server.ts`, `components/notifications/*` |
| Admin | Session-gated panel, sections, Server Actions | `app/[locale]/(site)/admin/**`, `components/admin/**`, `lib/admin.ts` |
| Monitoring proxy | Same-origin Clarity loader and telemetry for tabs opened before the direct integration | `app/monitoring/[...path]/route.ts` |
| Operational scripts | One-off importers, syncs, DB tests in rolled-back transactions | `scripts/*.mts`, `scripts/pglite/*.mjs` |

## Pattern Overview

**Overall:** Next.js 16 App Router monolith on Vercel, server-first, with Supabase as the single backend (Postgres with RLS, Auth, Storage, Realtime). The architecture is shaped by a hard cost constraint: Vercel Hobby allows 4 hours of Active CPU per 30 days for the whole team (`CLAUDE.md`). Most design decisions exist to keep work off Functions: static "anonymous" copies of public pages, CDN-cacheable responses, draw-once image caches, and time-based revalidation.

**Key Characteristics:**
- **Locale is a URL segment that is hidden from the visitor.** Every page lives at `app/[locale]/(site)/…`. `proxy.ts` rewrites `/obras/x` to `/es/obras/x` or `/es/anon/obras/x`. The address bar keeps the URL as typed.
- **Two renders for each public page.** A visitor with nothing personal (no `sb-*` session cookie, no referral for pages that show one) gets the `anon/` copy: prerendered per language, served from the CDN, revalidated by ISR. Everyone else gets the same page rendered per request. The two must look the same to a visitor without a session.
- **Session is read in one place.** Page code calls `getCurrentUser()` or `createClient()` from `lib/supabase/server.ts`, which return "nobody" or the public client during an anonymous render. Locale comes from `getI18n()`. Reading `cookies()`, `headers()` or `searchParams` directly in a component under a static page breaks the static copy.
- **Services never throw into pages.** Tracking, referrals, notifications and cron jobs catch and log their own failures. A feature that is not configured (`isSupabaseConfigured`, `isMercadoPagoConfigured`, `isMailConfigured`, R2 variables missing) takes a disabled path instead of failing the build or the page.
- **Strategy objects for variable behavior.** Payment providers (`lib/payments/provider.ts`), purchase kinds (`lib/payments/purchases.ts`) and mail transports (`lib/mail/transports.ts`) are chosen at runtime behind a small interface.
- **Repository for the notification table.** `lib/notifications/repository.ts` is the only code that queries it and works with either the server or browser Supabase client.
- **Two security boundaries for admin.** The page gate is `ADMIN_EMAILS` (`lib/admin.ts`); the real boundary is RLS (`is_admin()` in the migrations). Server Actions that use the service-role client repeat the admin check themselves (`assertIsAdmin` in `app/[locale]/(site)/admin/obras/actions.ts`).
- **Pure helpers with colocated tests.** Most `lib/*.ts` modules are framework-free and have a `*.test.ts` next to them (vitest, node environment). Modules that plain Node scripts or `proxy.ts` load avoid `@/` imports (for example `lib/static-pages.ts`, `lib/i18n/locales.ts`).

## Rendering Modes

| Mode | Where | Mechanism |
|------|-------|-----------|
| Static, anonymous copy, ISR | `app/[locale]/(site)/anon/**/page.tsx` (12 copies) | `renderAsAnonymous()` then re-exports the real page. `revalidate = 3600` (home, galeria-3d, club/[slug]) or `86400` (club, obras/[slug], onboarding, partners, revista, legal, artistas/[slug], donar/gracias) |
| Per request, personal | Real pages under `app/[locale]/(site)/` that show session or referral data: `page.tsx` for `/`, `/obras/[slug]`, `/galeria-3d`, `/club/[slug]`, `/museomar`, `/ar/[slug]`, `/artistas/[slug]` | `export const dynamic = 'force-dynamic'` |
| Per request, no static copy | Admin, mi-galeria, jurado, tienda, notificaciones, onboarding/obras, taller, gracias pages | Reads the session in the layout or page; not in `STATIC_PAGES` so the proxy never rewrites them to `anon/` |
| Unknown-path catch-all | `app/[locale]/(site)/[...missing]/page.tsx` | `dynamic = 'force-dynamic'`, calls `notFound()` so made-up URLs are not cached |
| ISR route handlers | `app/api/obras/route.ts`, `app/api/obras/[slug]/route.ts`, `app/api/club/casas/route.ts` (3600 s), `app/api/artistas/[slug]/social/route.ts` (600 s) | `export const revalidate` |
| Cache-Control handlers | `app/api/img/route.ts` (`s-maxage=31536000` for versioned photos, `86400` for mutable ones) | Response headers, CDN answers repeat hits |
| Cron handlers | `app/api/cron/*/route.ts` | Bearer `CRON_SECRET`, `maxDuration` 30–300 s |

## Layers

**Routing and request edge:**
- Purpose: decide which page renders and whether it may be served from the CDN.
- Location: `proxy.ts`, `lib/static-pages.ts`, `lib/i18n/locales.ts`, `lib/referral.ts`
- Contains: locale resolution, the `?lang=` redirect, the anon rewrite, the session refresh, the matcher.
- Depends on: `@supabase/ssr`, `lib/supabase/config.ts`, `lib/referral.ts`.
- Used by: every page request. The matcher skips `/api/`, `/monitoring/`, `/_next/`, `/_vercel/`, images, fonts, media and `.xml/.json/.txt`.

**Pages and layouts (UI routes):**
- Purpose: compose sections, read data, decide access.
- Location: `app/[locale]/layout.tsx`, `app/[locale]/(site)/**/page.tsx`, `app/[locale]/(site)/**/layout.tsx`, plus `loading.tsx`, `error.tsx`, `not-found.tsx` per segment.
- Contains: 61 `page.tsx` files, 1 layout under `(site)` and 1 under `admin/`.
- Depends on: `lib/*` (data), `components/*` (UI), `lib/i18n/server.ts`.
- Used by: the browser, through the proxy rewrite.

**Anonymous copies:**
- Purpose: prebuild public pages per language for visitors without a session.
- Location: `app/[locale]/(site)/anon/` mirrors the real page tree for the 12 entries in `STATIC_PAGES`.
- Contains: thin files that call `renderAsAnonymous()` and re-export the real page's default and `generateMetadata`. Some also set `generateStaticParams() { return [] }` (obra page) so pages are built on first visit.
- Depends on: `lib/render-mode.ts` and the real page.
- Used by: `proxy.ts` only. `lib/static-pages.test.ts` fails if a listed page has no copy, the copy does not call `renderAsAnonymous()` first, or it has no `revalidate`.

**Server Actions (mutations from forms and buttons):**
- Purpose: writes, from signed-in users and admins.
- Location: 25 files with `'use server'`, co-located with their page, e.g. `app/[locale]/(site)/onboarding/actions.ts`, `app/[locale]/(site)/donar/actions.ts`, `app/[locale]/(site)/galeria-3d/actions.ts`, `app/[locale]/(site)/galeria-3d/wall-actions.ts`, `app/[locale]/(site)/admin/*/actions.ts`, `app/[locale]/(site)/tienda/actions.ts`, `app/[locale]/(site)/taller/actions.ts`.
- Depends on: `lib/supabase/server.ts` (session), `lib/supabase/admin.ts` (service role, only where RLS cannot express it), `lib/public-data-cache.ts` (refresh after writes).
- Note: a Server Action is a public endpoint. It cannot rely on the page that rendered its button to have checked access.

**Route handlers (HTTP endpoints):**
- Purpose: webhooks, cron, image and data endpoints, client-called JSON, PDFs and icons.
- Location: 29 `route.ts` files under `app/api/**`, `app/[locale]/(site)/auth/callback/route.ts`, `app/[locale]/(site)/obras/[slug]/certificado/route.ts`, `app/[locale]/(site)/obras/[slug]/historia/route.tsx`, `app/[locale]/(site)/ar/[slug]/tarjetas/route.ts`, `app/monitoring/[...path]/route.ts`.
- Depends on: `lib/*` services.
- Used by: webhooks from providers, Vercel Cron, `components/*` via `fetch`, the CDN.

**Domain and service layer:**
- Purpose: business rules and external services.
- Location: `lib/` (304 files), `data/artworks.ts`, `lib/data/*.json` (geography for the map), `lib/argentina-provinces.json`.
- Depends on: Supabase clients, `resend`, `mercadopago`, `aws4fetch` (R2), `sharp`, `satori` through `next/og`, `zod`.

**Client UI:**
- Purpose: interactive pages, forms, and the 3D gallery.
- Location: `components/` (299 files). Shared primitives in `components/ui/`. Admin widgets in `components/admin/`. Gallery in `components/gallery/`.
- State: `zustand` stores (16 files import it), one per gallery feature, e.g. `components/gallery/club/store.ts`, `components/gallery/passport/store.ts`, `components/gallery/tutorial/store.ts`. Forms use local React state.
- Client-only Supabase: `lib/supabase/client.ts` (browser client). Realtime presence and the notification list use it.

**Data:**
- Purpose: persistent state.
- Location: Supabase migrations in `supabase/migrations/` (107 `.sql` files, `YYYYMMDDHHMMSS_name.sql`; the Supabase CLI link cache sits in `supabase/.temp/`, gitignored). R2 bucket (private) through `lib/r2.ts`.
- Access rules are enforced in SQL (RLS and `is_admin()`), not only in the app.

**Operations:**
- Purpose: imports, syncs, DB verification, build-time asset generation.
- Location: `scripts/*.mts`, `scripts/pglite/*.mjs`, `scripts/avatars/`, `scripts/apps-script/Registro.gs`, `scripts/brand-images.mjs`, `scripts/build-bases-pdf.mts`, `scripts/paypal-setup.mjs`. See STRUCTURE.md.

## Data Flow

### Primary Request Path (public page, visitor without a session)

1. Request `https://<site>/obras/<slug>` is matched by `config.matcher` in `proxy.ts`.
2. `proxy.ts` takes the language from the URL segment if present, else `resolveLocale()` from the `mdc-locale` cookie (`LOCALE_COOKIE`, `lib/i18n/locales.ts`), `Accept-Language`, and `x-vercel-ip-country`.
3. `pageTarget()` sees a static page (`isStaticPage`), no `sb-*` cookie, and no valid referral, so it rewrites to `/<locale>/anon/obras/<slug>`.
4. The CDN serves the prebuilt copy when it has one. On a miss, `app/[locale]/(site)/anon/obras/[slug]/page.tsx` calls `renderAsAnonymous()` (`lib/render-mode.ts`) and renders `app/[locale]/(site)/obras/[slug]/page.tsx`.
5. The page reads data through `cachedPublicData` loaders (`lib/finalists.ts`, `lib/call-state.ts`, `lib/public-obra-neighbors.ts`). These use `createPublicClient()` (`lib/supabase/public.ts`), the anon key, under RLS.
6. `getI18n()` returns the locale from the URL segment and messages from `lib/i18n/messages/<locale>.ts`.
7. Output is cached as ISR for `86400` s, or until a tag is revalidated by `refreshArtworkData()`.

### Personal Request Path (signed-in visitor)

1. The proxy sees an `sb-*` cookie, so it does not rewrite to `anon/`. It calls `supabase.auth.getUser()` through `@supabase/ssr` and writes refreshed cookies onto the response.
2. The page is rendered per request under `/<locale>/…`.
3. `getCurrentUser()` (`lib/supabase/server.ts`, React `cache()`, once per request) verifies the user with Supabase Auth.
4. Reads go through `createClient()` (cookie-bound, RLS) and writes through Server Actions.

### Image Path

1. Components call `imageSrc()` (`lib/image-src.ts`); next/image uses the custom loader `lib/image-loader.ts` (`next.config.mjs` → `images.loader: 'custom'`).
2. The URL is `/api/img?url=<supabase storage url>&w=<width>`. Only the project's public bucket and widths in `lib/image-widths.mjs` are accepted.
3. The CDN caches each `(url, width)` pair. On a miss, `app/api/img/route.ts`:
   - Looks for the variant in R2 (`lib/r2.ts`, key `img/<sha256(src)>/…`). A versioned source (`isVersionedSource`) is read without a HEAD.
   - Otherwise fetches the original from Storage, resizes with `sharp` to WebP (`IMAGE_QUALITY`), and stores it in R2.
4. Versioned sources get `immutable` headers for a year; mutable legacy paths get one day plus `stale-while-revalidate`.

### Share Image Path (link previews and story images)

1. `app/[locale]/(site)/obras/[slug]/opengraph-image.tsx` (ISR, `revalidate = 86400`) and the anon copy call `cachedShareImage()` (`lib/share-image-cache.ts`) with the drawing function from `lib/artwork-share-image.tsx`.
2. The key is `share/<sha256(TEMPLATE, drawn, photoUrl, version)>.png`. `TEMPLATE` is `SHARE_IMAGE_TEMPLATE`, a hash of the template source and fonts computed in `next.config.mjs`.
3. A hit reads R2 and returns the bytes. A miss draws with satori and stores the result, unless the photo failed to load (`complete: false`), which is not stored.

### Payment Path (Mercado Pago, PayPal)

1. A form or button calls a Server Action (for example `app/[locale]/(site)/donar/actions.ts`, `app/[locale]/(site)/tienda/actions.ts`, `app/[locale]/(site)/taller/actions.ts`) or a route handler (`app/api/paypal/orders/route.ts`, `app/api/paypal/subscriptions/route.ts`).
2. The provider (`lib/payments/providers/mercadopago.ts` or `paypal.ts`, both implementing `lib/payments/provider.ts`) opens a hosted checkout. The reference stored with it identifies the purchase.
3. The provider notifies `app/api/mercadopago/webhook/route.ts` or `app/api/paypal/webhook/route.ts`. Mercado Pago's signature is checked by `lib/mercadopago-signature.ts`; PayPal's return and capture go through `app/api/paypal/return/route.ts` and `app/api/paypal/orders/[id]/capture/route.ts`.
4. The webhook re-fetches the payment from the provider and calls `syncPayment()` (`lib/payments/apply.ts`), which dispatches to the purchase kind (`donationPurchase`, `coinPackPurchase`, `entryPurchase`, `magazinePurchase`, `workshopPurchase` in `lib/payments/apply.ts`). Each kind updates its own table.
5. Store subscriptions: Mercado Pago preapprovals and monthly charges go through `lib/mp-subscriptions.ts` (topics `subscription_preapproval` and `subscription_authorized_payment`). PayPal store subscriptions use `lib/payments/paypal/*` and `app/api/paypal/webhook/route.ts`. Club subscriptions use `lib/club-subscriptions.ts`, `lib/club-payments.ts`, `lib/club-plans.ts`.
6. Webhooks always answer 200 for topics they do not need. A signature mismatch is the only deliberate failure.

### Mail Path

1. A caller calls `sendMail()` (one message) or `sendMails()` (a batch) in `lib/mail/index.ts`, with `transactional` or `bulk` intent.
2. Transactional mail (receipts, jury, admin notices) goes to Resend first, then Brevo. Bulk mail (certificates, welcomes, campaigns) goes to Brevo first, then Resend minus `RESEND_RESERVE`.
3. `lib/mail-quota.ts` reads what each provider has left (from `mail_usage` plus the last value synced from `/admin/envios`), splits big sends across providers, and records every accepted send.
4. Transports in `lib/mail/transports.ts` (`lib/resend.ts` for Resend, Brevo's API for the other).
5. Delivery and bounce events come back to `app/api/resend/webhook/route.ts` (signed with `RESEND_WEBHOOK_SECRET`, verified by `lib/resend-signature.ts`) and `app/api/brevo/webhook/route.ts` (bearer or `?token=` with `BREVO_WEBHOOK_SECRET`). Both feed `lib/mail/webhook.ts` and `lib/mail/events.ts`.
6. Campaigns: `app/[locale]/(site)/admin/campanas/actions.ts` creates a campaign, `lib/campaign-audience.ts` selects recipients, `lib/campaign-schedule.ts` and the `campanas` cron (`app/api/cron/campanas/route.ts`) send it. Templates are in `lib/system-templates.ts`; translations in `lib/email-translation.ts`.

### Registro Sync (Google Sheets to obras)

1. The registration spreadsheet is read live through `lib/google-sheets.ts`, every two hours by `app/api/cron/registro/route.ts` (`0 */2 * * *`), or by hand with `scripts/sync-registro.mts` (optionally from a JSON snapshot in `.local/`).
2. `lib/registro.ts` parses the A:F grid (Drive chips and links included) and plans the changes. `lib/registro-sync.ts` is shared by the cron and the script, so both validate, back up, archive and fetch images the same way.
3. Rows become `legacy_submissions` (`lib/legacy-submissions.ts`, which uses `sharp` and `lib/registro-image-fingerprint.ts` to detect duplicate photos). `lib/reuse-registro-artwork.ts` and `lib/publish-legacy.ts` publish or relink obras, and the rows are provisioned as profiles.
4. Corrections to already published obras reach the public pages through `refreshArtworkData()`.

### 3D Gallery Path

1. `app/[locale]/(site)/galeria-3d/page.tsx` is `force-dynamic`. It calls `getCurrentUser()`; without a user it renders `GallerySignIn` (`components/gallery/GalleryAccess.tsx`). With one it loads `getGalleryArtworks(locale)` (`lib/gallery-artworks.ts`, cached daily selection through `lib/exhibition-day.ts`) and renders `GalleryAccess`.
2. `GalleryAccess` subscribes to Supabase auth changes in the browser and renders `components/gallery/Game.tsx`. `Game` loads `Scene` through `next/dynamic` with `ssr: false` (`components/gallery/Scene.tsx`), so Three.js stays out of the server bundle.
3. World data: `components/gallery/world/roomsData.ts`, MAR museum `components/gallery/world/mar/*`, visitor routes `components/gallery/world/visitorRoutes.ts`.
4. Presence: `components/gallery/presence/GalleryPresence.tsx` joins a Supabase Realtime channel. `protocol.ts` validates every incoming message, because anyone with the anon key can publish.
5. Attention: `components/gallery/attention/AttentionRecorder.tsx` batches dwell time per artwork and posts to `app/api/gallery/attention/route.ts` (same-origin check, bounded body, service-role write). `lib/gallery-attention.ts` parses and bounds the batch.
6. Stamps and passport: `components/stamp-visit.tsx` records the visit through `app/api/stamps/route.ts`.

### Club Galleries Path

1. `/club` (`app/[locale]/(site)/club/page.tsx`) shows the house map and sample galleries. Its anonymous copy is `anon/club/page.tsx` (`revalidate = 86400`).
2. `/club/[slug]` (`app/[locale]/(site)/club/[slug]/page.tsx`) is `force-dynamic` with its own anon copy `anon/club/[slug]/page.tsx` (`revalidate = 3600`). It calls `getClubGalleryBySlug()` (`lib/club-galleries.ts`), which uses `cachedPublicData` with the `club-gallery:<hash>` tag, and renders `components/gallery/ClubGame.tsx`.
3. Gallery owners edit through `app/[locale]/(site)/mi-galeria/editar/actions.ts`, and each save calls `refreshClubGallery(slug)` (`lib/public-data-cache.ts`), which also drops the map and the samples.
4. The map: `lib/club-map.ts` rounds each house to a tenth of a degree before storing it; `lib/club-map-data.ts` supplies geography; `app/api/club/casas/route.ts` is the CDN-cached list (`revalidate = 3600`).
5. The whole Club is closed until `CLUB_OPEN=on` (`lib/club-launch.ts`). Admins (`ADMIN_EMAILS`) can use it while closed.

### Cron Path

1. Vercel Cron calls the paths in `vercel.json` with `Authorization: Bearer $CRON_SECRET`:
   - `/api/cron/registro` every 2 hours
   - `/api/cron/exhibition` at 12:05 UTC (09:05 Argentina): exhibition mails, artist digests, supporter welcomes, and `refreshExhibition()`
   - `/api/cron/campanas` at 12:10 UTC (09:10 Argentina): sends every scheduled campaign due today or earlier; each is claimed by setting it to `sending` first
   - `/api/cron/certificados` at 00:15 UTC: after the call closes, sends pending or failed certificates up to the day's quota (`lib/certificate-mail.ts`)
   - `/api/cron/infra` at 12:20 UTC: a small daily check that the Supabase plan/token and gallery images still work; it only mails the admins, changes nothing
2. Each route is `cronRoute(handler)` from `lib/cron.ts`: it rejects anything but the secret, reads `?dry=1`, and runs jobs through `runCronJobs()`, so one failing job does not stop the others. Problems are mailed to `ADMIN_EMAILS` with `mailAdmins()`.

### Tracking Path

1. `components/track.tsx` and `TrackedLink` call `lib/track.ts`, which queues steps and sends them in one batch to `app/api/track/route.ts` (`navigator.sendBeacon` when the page is left).
2. The route accepts only known step names (`isFunnelEvent`) and well-formed anonymous visitor ids (`VISITOR_ID_PATTERN`). The account is taken from the session, not the body.
3. `lib/track-server.ts` writes `funnel_events` with the service role. `/admin/estadisticas` reads them.
4. Analytics scripts: `components/clarity.tsx` (Microsoft Clarity loader) and `components/vercel-analytics.tsx` / `@vercel/speed-insights` in the root layout. `app/monitoring/[...path]/route.ts` proxies Clarity for old tabs.

### Admin Path

1. `app/[locale]/(site)/admin/layout.tsx` checks `isSupabaseConfigured`, then `getCurrentUser()`, then `ADMIN_EMAILS`. Anyone else is redirected to `/`.
2. `app/[locale]/(site)/admin/page.tsx` redirects to `/admin/estadisticas`.
3. Sections are declared once in `components/admin/admin-sections.ts` (`adminSections`) and rendered by `components/admin/admin-nav.tsx`.
4. Each section is `admin/<name>/page.tsx` with a sibling `actions.ts`. Pages render per request. Writes go through Server Actions, which call `refreshPublicData()` or `refreshArtworkData()` when they change public data.

### Secondary Flow: Localization

1. `lib/i18n/locales.ts` defines 9 locales (`es` source, then `en pt it fr de ru pl id`).
2. Messages: `lib/i18n/messages/<locale>.ts` plus `lib/i18n/messages/index.ts` (merged `MESSAGES`), `lib/i18n/messages/client.ts` (`pickClientMessages`) for what the browser needs.
3. Client components call `useI18n()` (`lib/i18n/client.tsx`). Server code calls `getI18n()`. Formatting helpers are in `lib/i18n/format.ts`.
4. Mail translation for campaigns is machine-assisted (`lib/email-translation.ts`, `lib/email-translator.ts`); `lib/i18n/messages.test.ts` checks message keys.

**State Management:**
- Server state: Supabase rows, cached by `unstable_cache` tags (see Caching Layers) and by React `cache()` per request.
- Client state: zustand stores in gallery features; React state in forms; browser storage for gallery preferences (`components/gallery/preferences/store.ts`) and the visit source cookie (`lib/visit-source.ts`).
- URL state: `?ref=`, `?lang=`, admin filters.

## Caching Layers

| Layer | Scope | Set by | Dropped by |
|-------|-------|--------|------------|
| Vercel CDN | Anon pages, `/api/img`, `/api/obras`, `/api/club/casas`, `/api/artistas/[slug]/social` | `Cache-Control` and ISR | Every production deploy empties it (`CLAUDE.md`); `revalidate` |
| ISR of anonymous pages | Per language, per path | `revalidate` on each `anon/` file | `revalidateTag` from `lib/public-data-cache.ts` |
| `unstable_cache` data | Public data loaders (`cachedPublicData`) | `lib/public-data-cache.ts`: 3600 s request, 86400 s anonymous | `refreshPublicData()` (tag `public-data`), `refreshArtworkData()` (per obra and artist tags), `refreshExhibition()`, `refreshClubGallery(slug)` |
| Cloudflare R2 | Photos (`img/…`), sizes, share images (`share/<hash>.png`) | `lib/r2.ts`, `lib/share-image-cache.ts` | Changed source version (new key). No deletion job. |
| React `cache()` | One request | `getLocale`, `getI18n`, `getCurrentUser`, `getCallState`, `getUnreadNotificationCount`, `isAnonymousRender` | Ends with the request |
| Browser | Stamps, preferences, `sendBeacon` queue | Client modules | Client-side |

Tag names are in `lib/public-cache-tags.ts`: `public-data:<key>`, `artwork:<sha256(slug)>`, `artist:<profile id>`, `club-gallery:<sha256(slug)>`. Hashes keep them under Next's 256-character limit.

## Key Abstractions

**`STATIC_PAGES` and `isStaticPage()`:**
- Purpose: the list of public pages that have an `anon/` copy. Also used by the proxy to decide the rewrite.
- Examples: `lib/static-pages.ts`, consumed by `proxy.ts` and `lib/static-pages.test.ts`.
- Pattern: a list of route patterns compiled to regexes (`[slug]` → `[^/]+`).
- Current list: `/`, `/obras/[slug]`, `/artistas/[slug]`, `/club`, `/club/[slug]`, `/galeria-3d`, `/onboarding`, `/partners`, `/revista`, `/politica-de-privacidad`, `/terminos-y-condiciones`, `/donar/gracias`.

**`renderAsAnonymous()` / `isAnonymousRender()`:**
- Purpose: tell session and referral readers that this render has no visitor.
- Examples: `lib/render-mode.ts`, called in `app/[locale]/(site)/anon/page.tsx`, `anon/galeria-3d/page.tsx`, `anon/obras/[slug]/page.tsx`.
- Pattern: request-scoped flag held in React `cache()`. Must be called in both `generateMetadata` and the page component when the page has both.

**`getCurrentUser()` and `createClient()`:**
- Purpose: the only sanctioned way to read the session in a page.
- Examples: `lib/supabase/server.ts`. Used by `app/[locale]/(site)/admin/layout.tsx`, `app/[locale]/(site)/galeria-3d/page.tsx`, `app/[locale]/(site)/mi-galeria/page.tsx`.
- Pattern: `createClient()` returns `createPublicClient()` in an anonymous render and a cookie-bound client otherwise. `getCurrentUser` is `cache()`d and returns null in an anonymous render. Server Actions and route handlers must call `getUser()` themselves because `cache()` does not memoize there.

**`createPublicClient()` / `createAdminClient()`:**
- Purpose: anon-key reads for public data, service-role writes that RLS would block.
- Examples: `lib/supabase/public.ts` (used by `lib/call-state.ts`, `lib/club-galleries.ts`, `lib/gallery-artworks.ts`); `lib/supabase/admin.ts` (used by `lib/track-server.ts`, `lib/mail/index.ts`, `app/api/gallery/attention/route.ts`, `lib/payments/purchases.ts`).
- Pattern: admin client is server-only. Any new use must have an access check first.

**`isSupabaseConfigured`, `isMercadoPagoConfigured`, `isMailConfigured`, `isResendConfigured`:**
- Purpose: feature gates from environment variables. CI builds without credentials on purpose (`.github/workflows/ci.yml`).
- Examples: `lib/supabase/config.ts`, `lib/mercadopago.ts`, `lib/mail/index.ts`, `lib/r2.ts` (`imageStore()` returns null without `R2_*`).
- Pattern: check before calling the service; render the disabled state otherwise.

**`getI18n()` / `getLocale()` and `useI18n()`:**
- Purpose: one way to get the locale and messages on each side.
- Examples: `lib/i18n/server.ts`, `lib/i18n/client.tsx`. Root layout passes `pickClientMessages(m)` into `I18nProvider`.
- Pattern: in a page the URL segment wins (`next/root-params` `locale`); in a Server Action or route handler the cookie, then `Accept-Language`, then country decides.

**`cachedPublicData()` and the `refresh*` functions:**
- Purpose: cache public reads across requests and drop them exactly when data changes.
- Examples: `lib/public-data-cache.ts`. Callers: `lib/finalists.ts`, `lib/gallery-artworks.ts`, `lib/call-state.ts`, `lib/club-galleries.ts`.
- Pattern: wrap a loader with key, tags and an anonymous-aware `revalidate`. After a write, call the narrowest refresh (`refreshArtworkData` for content, `refreshPublicData` for membership, `refreshClubGallery` for one gallery). Tests mock the module (`vitest.setup.ts`).

**`cachedShareImage()` and `ImageStore`:**
- Purpose: draw an image once; later requests read the bytes back from R2.
- Examples: `lib/share-image-cache.ts`, `lib/r2.ts`, `lib/artwork-share-image.tsx`. Not every renderer uses it: print cards (`lib/ar/print-cards.tsx`, `app/[locale]/(site)/ar/[slug]/tarjetas/route.ts`) and certificates (`lib/certificate.tsx`) are drawn on request by the artist, as the allowlist below records.
- Pattern: content-addressed key (sha256 of everything that is drawn). Never store a render whose photo failed to load.

**Image renderer allowlist:**
- Purpose: stop new server-side image drawing from being added without a cache.
- Examples: `lib/cost-guards.test.ts` (`IMAGE_RENDERERS`). Current entries: `app/api/img/route.ts`, `app/[locale]/opengraph-image.tsx`, `lib/artwork-share-image.tsx`, `lib/certificate.tsx`, `lib/ar/print-cards.tsx`, `lib/legacy-submissions.ts`, `lib/registro-image-fingerprint.ts`.
- Pattern: a test that reads the source and fails on any unlisted `new ImageResponse(` or `from 'sharp'`.

**`cronRoute()`, `runCronJobs()`, `mailAdmins()`:**
- Purpose: uniform scheduled jobs.
- Examples: `lib/cron.ts`; `app/api/cron/exhibition/route.ts`, `app/api/cron/registro/route.ts`.
- Pattern: each job returns `{ result, problem? }`. A thrown error becomes `{ error }` in the report and a problem mail.

**`PaymentProvider` and purchase kinds:**
- Purpose: keep "how money moves" separate from "what is being paid for".
- Examples: `lib/payments/provider.ts` (interface), `lib/payments/providers/mercadopago.ts`, `lib/payments/providers/paypal.ts`, `lib/payments/apply.ts`, `lib/payments/purchases.ts`, `lib/donation-payments.ts`, `lib/coin-pack-payments.ts`, `lib/entry-payments.ts`, `lib/magazine-payments.ts`, `lib/workshop-payments.ts`.
- Pattern: strategy per provider; a purchase kind is a strategy that says what a payment changes. A new kind plugs into `apply.ts`.

**Mail send path:**
- Purpose: one entry point for all mail, with quota-aware provider choice.
- Examples: `lib/mail/index.ts`, `lib/mail/transports.ts`, `lib/mail-quota.ts`, `lib/mail/events.ts`, `lib/mail/webhook.ts`.
- Pattern: callers describe intent (transactional or bulk); the module chooses and fails over.

**`ADMIN_EMAILS`:**
- Purpose: the page-level admin gate and the list of people who receive operational mail.
- Examples: `lib/admin.ts`, used by `admin/layout.tsx`, `lib/cron.ts`, `lib/club-launch.ts`, `lib/referral-server.ts`. Kept in sync with `is_admin()` in a migration (the real boundary).

**`Artwork` and finalists:**
- Purpose: the shape of a public obra in the gallery and on pages.
- Examples: `data/artworks.ts` (type `Artwork`, `gallerySlots`, `clubGallerySlots`, `GALLERY_FRAME_STYLES`), `lib/finalists.ts` (`getFinalists`, `getFinalistBySlug`, `getArtworkShareState`), `lib/gallery-artworks.ts`, `lib/obra-detail.ts`.

**Referrals and funnel:**
- Purpose: artist invitations and the visitor circuit.
- Examples: `lib/referral.ts` (`REFERRAL_PARAM = 'ref'`, cookie `mdc-ref`), `lib/referral-server.ts`, `lib/funnel.ts` (`FunnelEvent`), `lib/track.ts`, `lib/track-server.ts`, `lib/visit-source.ts`, `lib/in-app-browser.ts`.

**Notification repository:**
- Purpose: one data-access module for the bell.
- Examples: `lib/notifications/repository.ts` (`notificationRepository(client)`), `lib/notifications/registry.ts` (kinds), `lib/notifications/state.ts`, `lib/notifications/time.ts`.

**Club gallery model:**
- Purpose: paid, owner-edited galleries with a shared map.
- Examples: `lib/club-galleries.ts`, `lib/club-editor.ts`, `lib/club-map.ts`, `lib/club-plans.ts`, `lib/club-courtesy.ts`, `lib/club-next-gallery.ts`, `lib/club-samples.ts`, `components/gallery/club/store.ts`.

## Entry Points

**HTTP request edge:**
- Location: `proxy.ts` (exported `proxy` and `config.matcher`; Next 16 uses `proxy.ts` instead of `middleware.ts`; no `middleware.ts` exists).
- Triggers: any page request not excluded by the matcher.

**Root layout:**
- Location: `app/[locale]/layout.tsx`. Defines `generateStaticParams` for the nine locales and `generateMetadata`.
- Triggers: every page.

**Site and admin layouts:**
- Location: `app/[locale]/(site)/layout.tsx`, `app/[locale]/(site)/admin/layout.tsx`.

**Public pages:**
- Location: `app/[locale]/(site)/page.tsx` (home), `obras/[slug]/page.tsx`, `galeria-3d/page.tsx`, `club/page.tsx`, `club/[slug]/page.tsx`, `artistas/[slug]/page.tsx`, `museomar/page.tsx`, `jurado/page.tsx`, `revista/page.tsx`, `tienda/page.tsx`, `taller/inscripcion/page.tsx`, `onboarding/page.tsx`.

**Sign-in callback:**
- Location: `app/[locale]/(site)/auth/callback/route.ts`. Exchanges the Google OAuth code for a session, then redirects through `lib/safe-next.ts`.

**Webhooks:**
- `app/api/mercadopago/webhook/route.ts`, `app/api/paypal/webhook/route.ts`, `app/api/resend/webhook/route.ts`, `app/api/brevo/webhook/route.ts`.

**Cron:**
- `app/api/cron/registro/route.ts`, `exhibition`, `campanas`, `certificados`, `infra` (schedules in `vercel.json`).

**Client-called endpoints:**
- `app/api/track/route.ts`, `app/api/gallery/attention/route.ts`, `app/api/stamps/route.ts`, `app/api/artworks/surprise/route.ts`, `app/api/shipping/quote/route.ts`, `app/api/shipping/branches/route.ts`, `app/api/club/casas/route.ts`, `app/api/obras/route.ts`, `app/api/obras/[slug]/route.ts`, `app/api/artistas/[slug]/social/route.ts`, `app/api/img/route.ts`, `app/api/unsubscribe/route.ts`, `app/api/paypal/orders/route.ts`, `app/api/paypal/subscriptions/route.ts`.

**Generated files:**
- `app/sitemap.ts` (ISR 3600 s), `app/robots.ts`, `app/[locale]/opengraph-image.tsx` (ISR 3600 s), `app/[locale]/icon.png`, `app/[locale]/apple-icon.png`.

**Build and CI:**
- `.github/workflows/ci.yml`: lint, `next typegen`, `tsc --noEmit`, `npm test`, `npm run build`, then `supabase-migrations.yml` (`supabase db push --remote`), then a Vercel deploy hook. `vercel.json` disables Git auto-deploy for `main`.

**Scripts:**
- `scripts/*.mts` run with `node --env-file=.env.local --import ./scripts/node-project-imports.mjs`. See STRUCTURE.md for the list.

## Architectural Constraints

- **Runtime:** Vercel Functions. Routes that need Node APIs or `sharp` run on Node: `app/api/paypal/*` pins `export const runtime = 'nodejs'`; `app/api/img/route.ts`, `lib/share-image-cache.ts`, `lib/r2.ts` use `node:crypto` or `sharp`. `proxy.ts` must stay light: it runs on every page request.
- **Threading:** Not applicable. Each request is handled independently; no worker threads or queues in the code.
- **Global state:**
  - `TEMPLATE` in `lib/share-image-cache.ts` is read from `SHARE_IMAGE_TEMPLATE` at import, which `next.config.mjs` injects from file hashes at build.
  - `isSupabaseConfigured` and the other `is*Configured` flags are evaluated once at module load from `process.env`.
  - Module-level zustand stores in `components/gallery/**/store.ts` are per-tab singletons on the client.
  - `lib/supabase/client.ts` creates a new browser client each call (`createBrowserClient`).
- **Circular imports:** Not checked by tooling. Keep `lib/static-pages.ts` and `lib/i18n/locales.ts` free of `@/` imports: `proxy.ts` and plain Node scripts load them directly.
- **Build-time network:** `app/sitemap.ts` reads obras at build time. CI builds without Supabase variables on purpose so it takes the "not configured" path (`.github/workflows/ci.yml`).
- **Anonymous copies must stay static:** a component under `STATIC_PAGES` that reads `cookies()`, `headers()` or `searchParams` turns the copy from static into dynamic. The build then shows `ƒ` where `anon` routes must show `●` (`CLAUDE.md`).
- **Migrations ship on merge:** a migration reaches production when the CI workflow runs on `main`, before the deploy, so migrations are tested with PGlite first (`scripts/pglite/harness.mjs`).
- **Deploy cadence:** every production deploy empties the CDN cache. Commits are pushed to `main` in batches (`CLAUDE.md`, `.github/workflows/ci.yml`).

## Anti-Patterns

### Reading the session or headers in a shared component

**What happens:** A component on a static page calls `cookies()`, `headers()` or reads `searchParams` directly.
**Why it's wrong:** The page stops being prerendered. Its `anon/` copy becomes a per-request Function run, which is the cost the copy exists to avoid, and the build shows `ƒ` instead of `●`.
**Do this instead:** `getCurrentUser()` / `createClient()` from `lib/supabase/server.ts` and `getI18n()` from `lib/i18n/server.ts`. Check `lib/static-pages.test.ts` and the build output after the change.

### Drawing an image on each request

**What happens:** A new route calls `new ImageResponse(...)` or `sharp` on every request.
**Why it's wrong:** Each draw costs 0.1–0.5 s of CPU, and crawlers repeat requests. This was the largest single cost in October 2026 (`lib/cost-guards.test.ts`).
**Do this instead:** Key the output by what it draws and store it in R2 with `cachedShareImage()` (`lib/share-image-cache.ts`), or let ISR keep it (`app/[locale]/(site)/obras/[slug]/opengraph-image.tsx`). Add the file to `IMAGE_RENDERERS` in `lib/cost-guards.test.ts` with how it avoids redrawing.

### Opting an ISR route out of its cache with `cache: 'no-store'`

**What happens:** A fetch inside an `revalidate`d route passes `cache: 'no-store'`.
**Why it's wrong:** The fetch throws in an ISR route. A `try/catch` then falls back to a slow path, and the result is never cached (`lib/cost-guards.test.ts`, the October 2026 regression note).
**Do this instead:** Omit the `cache` option, as `lib/r2.ts` and `lib/share-image-cache.ts` do.

### Trusting the page to check access for a Server Action

**What happens:** A Server Action that uses the service-role client assumes the page's admin gate protected it.
**Why it's wrong:** A Server Action is a public endpoint. It can be called without rendering the page.
**Do this instead:** Repeat the check inside the action (`assertIsAdmin` in `app/[locale]/(site)/admin/obras/actions.ts`), then use the service-role client. Where RLS can express the rule, use the session client and let the policy decide (as most of that file does).

### Dropping the whole public-data cache for a content edit

**What happens:** Editing one obra's text calls `refreshPublicData()`, which drops every public-data tag.
**Why it's wrong:** Every public page and the routes built from that data are rebuilt, each rebuild an ISR write billed by size (`lib/public-data-cache.ts`).
**Do this instead:** Use the narrowest refresh: `refreshArtworkData()` for content, `refreshClubGallery(slug)` for one gallery, and `refreshPublicData()` only for membership, imports, publication or profile changes, as those comments describe.

### A new public page without its anonymous copy

**What happens:** A page is added to `STATIC_PAGES` but its `anon/` file is missing, or the copy does not call `renderAsAnonymous()`.
**Why it's wrong:** `proxy.ts` sends visitors to a route that does not exist (404) or that renders the signed-in version.
**Do this instead:** Create `app/[locale]/(site)/anon/<path>/page.tsx` following `anon/club/page.tsx`, with `renderAsAnonymous()` and `export const revalidate`. `lib/static-pages.test.ts` enforces this.

## Error Handling

**Strategy:** Degrade and log, do not throw into the page. Feature code that must never break its host returns a fallback and logs with `console.error`.

**Patterns:**
- Tracking and referrals never throw: `lib/track-server.ts`, `lib/referral-server.ts` (their headers say so).
- Notification count returns 0 on failure: `lib/notifications/server.ts`.
- `getCallState()` assumes "open" when the database cannot be read, so artists are not turned away by mistake (`lib/call-state.ts`).
- Share image: a failed R2 read or write is logged and the image is drawn anyway; a render without its photo is never stored.
- Cron: `runCronJobs()` isolates jobs; errors become report entries and mails to admins (`lib/cron.ts`).
- Webhooks: unknown topics get 200 so providers do not retry forever; an invalid signature gets a rejection (`app/api/mercadopago/webhook/route.ts`).
- Admin gate: `redirect('/')` for any non-admin; no error page (`app/[locale]/(site)/admin/layout.tsx`).
- Unknown URLs: `notFound()` through `app/[locale]/(site)/[...missing]/page.tsx`, rendered with `app/[locale]/(site)/not-found.tsx`.
- Route-level error boundaries: `error.tsx` files under `app/[locale]/(site)/` (for example `app/[locale]/(site)/error.tsx`).

## Cross-Cutting Concerns

**Logging:** `console.error` / `console.warn` with a prefix naming the module (`"share image: R2 read failed"`, `"notifications: unread count failed"`, `"cron mail failed: …"`). Mail sends record outcomes in `mail_usage` (`lib/mail-quota.ts`). Funnel steps in `funnel_events`. Browser analytics: Vercel Analytics, Speed Insights, Clarity (`components/clarity.tsx`).

**Validation:** `zod` is used in four modules (`grep -rl "from 'zod'" app lib components`). Hand-written validators are more common: `parseAttentionBatch` (`lib/gallery-attention.ts`), `isFunnelEvent` and `VISITOR_ID_PATTERN` (`lib/funnel.ts`), `isStampKey` (`lib/stamps.ts`), `isLocale` (`lib/i18n/locales.ts`), `parseReferral` (`lib/referral.ts`), `safeWebAddress` (`lib/club-contact.ts`), `isValidEmail` (`lib/resend.ts`), `safeNextUrl` (`lib/safe-next.ts`), and `isValidGalleryMessage` in `components/gallery/presence/protocol.ts`.

**Authentication:** Supabase Auth with Google OAuth (`components/auth/google-sign-in-button.tsx`, callback `app/[locale]/(site)/auth/callback/route.ts`). Session cookies `sb-*` managed by `@supabase/ssr`, refreshed in `proxy.ts`. Admin: `ADMIN_EMAILS` plus RLS `is_admin()`. Cron: `CRON_SECRET` bearer. Webhooks: provider signatures (`lib/mercadopago-signature.ts`, `lib/resend-signature.ts`) or bearer tokens (Brevo).

**Authorization for the Club:** `canUseClub(email)` in `lib/club-launch.ts`, plus `CLUB_OPEN`. Gallery owners are checked in `lib/club-editor.ts` and the `mi-galeria/editar` actions.

**Security headers and abuse limits:** `app/api/gallery/attention/route.ts` checks the `Origin` header and bounds the request body. `app/api/img/route.ts` rejects extra parameters and arbitrary hosts. Vercel firewall rules are configured in the Vercel dashboard, not in the repo.

---

*Architecture analysis: 2026-11-08*
