---
last_mapped_commit: 6f52dfd
---

# Coding Conventions

**Analysis Date:** 2026-11-08

## Naming Patterns

**Files:**
- Every source file is kebab-case: `lib/gallery-return.ts`, `components/countdown.tsx`, `components/admin/page-header.tsx`, `components/gallery/camera/fov.ts`.
- Next.js route files keep the framework names: `page.tsx`, `layout.tsx`, `route.ts`, `actions.ts`, `opengraph-image.tsx`, `sitemap.ts`, `robots.ts`.
- Colocated helpers next to a route are kebab-case too: `app/[locale]/(site)/jurado/score-card.tsx`, `app/[locale]/(site)/taller/inscripcion/registration-form.tsx`.
- Test files sit next to their subject with a `.test.ts` / `.test.tsx` suffix: `lib/entries.ts` → `lib/entries.test.ts`. Root-level scripts use `.test.mts` (`scripts/registro.test.mts`). No `.spec.*` files exist.
- Domain names are Spanish and kept as-is in paths and identifiers: `obras`, `artistas`, `galeria-3d`, `tienda`, `donar`, `club`, `mi-galeria`, `onboarding`, `taller`, `revista`, `jurado`. Route segments and file names follow the public URLs.
- Some files share a name across directories with a feature suffix: `lib/mp-subscriptions.ts` and `lib/mp-subscriptions.recover.test.ts`.

**Functions:**
- camelCase for everything: `slugify()` (`lib/slug.ts`), `entryLimit()`, `resolveEntryChoice()` (`lib/entries.ts`), `getTimeLeft()` (`components/countdown.tsx`, not exported).
- Verb-first names for actions and data loaders: `startDonation` (`app/[locale]/(site)/donar/actions.ts`), `startMpSubscription` (`app/[locale]/(site)/tienda/actions.ts`), `getGalleryArtworks` (`lib/gallery-artworks.ts`), `recordFunnelEvents` (`lib/track-server.ts`).
- Predicates use `is`, `has`, `needs`, `can`: `isLocale()` (`lib/i18n/locales.ts`), `isSupabaseConfigured` (`lib/supabase/config.ts`), `needsEntryChoice()` (`lib/entries.ts`), `isAuthorizedCron()` (`lib/cron.ts`).
- Cached server reads are wrapped with React `cache()` and named as plain nouns: `getCurrentUser` (`lib/supabase/server.ts`), `getLocale` (`lib/i18n/server.ts`).

**Components:**
- React components are PascalCase named exports. Most component files are kebab-case (`components/countdown.tsx` exports `Countdown`). The 3D gallery is the exception: `components/gallery/` holds PascalCase component files (`Game.tsx`, `Scene.tsx`, `ClubGame.tsx`, `GalleryAccess.tsx`), and its subfolders are kebab-case (`camera/`, `presence/`, `world/`). Follow the folder you are in.
- Page components are `export default function Page()` in `page.tsx` (61 page files). Shared components use named exports (11 default exports exist across `components/` and `lib/`).

**Variables and properties:**
- camelCase locals and object properties. Constants are SCREAMING_SNAKE_CASE at module level: `ENTRY_PREFIX` (`lib/entries.ts`), `TRACK_BATCH_MAX` and `VISITOR_ID_PATTERN` (`lib/funnel.ts`), `LOCALE_COOKIE` (`lib/i18n/locales.ts`), `REFERRAL_COOKIE` (`lib/referral.ts`).
- Environment variables are SCREAMING_SNAKE_CASE and read directly from `process.env` in lib code (56 reads across `lib/`): `SUPABASE_SERVICE_ROLE_KEY`, `CLUB_OPEN`, `NEXT_PUBLIC_GALLERY_LIVE`, `NEXT_PUBLIC_HOME_LIVE`.
- Database columns and tables are snake_case (`funnel_events`, `visitor_id`, `in_app`, `club_galleries`), and the TypeScript side keeps them as returned, e.g. `{ name, visitor_id, user_id, in_app }` in `lib/track-server.ts`.

**Types:**
- PascalCase: `EntryChoice`, `MpSubscriptionState`, `Locale`, `FunnelEvent`, `InAppBrowser` (`lib/in-app-browser.ts`).
- Derive union types from const arrays rather than duplicating literals: `export const LOCALES = [...] as const; export type Locale = (typeof LOCALES)[number]` (`lib/i18n/locales.ts`).
- Import types with the `type` modifier inline or as a separate line. About 270 source files do it: `import type { InAppBrowser } from '@/lib/in-app-browser'` (`app/api/track/route.ts`), `import { ..., type MagazineField } from '@/lib/magazine'` (`app/[locale]/(site)/tienda/actions.ts`).

## Code Style

**Formatting:**
- No Prettier config exists (no `.prettierrc*`, no `biome.json`, no `.editorconfig`). Formatting is hand-kept and consistent across the codebase:
  - No semicolons.
  - Single quotes for JS/TS string literals. JSX attributes use double quotes (`className="…"` appears in 200 TSX files and never in single quotes).
  - Two-space indentation.
  - Trailing commas in multi-line objects, arrays, and parameter lists.
  - Lines are long in practice (120–180 characters is common, e.g. `lib/entries.ts`, `app/[locale]/(site)/tienda/actions.ts`). Break at logical boundaries rather than at a fixed width.
- Match the file you are editing. Do not reformat unrelated lines; a formatter run across the tree would produce a large unrelated diff.

**Linting:**
- ESLint flat config at `eslint.config.mjs`: `eslint-config-next/core-web-vitals` only. There are no custom rules and no `typescript-eslint` strict set.
- Run with `npm run lint` (`eslint .`). CI runs it on every push and pull request (`.github/workflows/ci.yml`, job `check`).
- `.claude/**` is excluded from lint (agent worktrees).
- Suppressions are rare and local, and always name the rule: `{/* eslint-disable-next-line @next/next/no-img-element */}` in `lib/certificate.tsx` (5 occurrences in that one file). Do not add a blanket `eslint-disable`.
- `@ts-ignore` / `@ts-expect-error` appear in non-test code only in a handful of places; prefer narrowing types over suppressing.

**TypeScript:**
- `strict: true` (`tsconfig.json`). `noEmit: true`; the build is Next's compiler. CI runs `npx tsc --noEmit` after `npx next typegen`.
- Path alias `@/*` resolves to the repository root (`tsconfig.json` and `vitest.config.mts`). Use `@/` for every cross-directory import, even from deep nested files: `import { createClient } from '@/lib/supabase/server'`.
- `any` is effectively absent from `lib/`, `app/` and `components/` (one occurrence). Use `unknown` and narrow.
- Parameter and return types are explicit on exported functions. Inferred types are fine for local variables and inline callbacks.

**Styling (Tailwind CSS 4):**
- Utilities live in `className` strings. Theme tokens are declared in `app/globals.css` under `@theme inline` and used as utilities: `border-ink/15`, `bg-card/80`, `rounded-2xl`, `shadow-sm` (`components/countdown.tsx`).
- Component-specific CSS is a sibling `.css` file imported by the component: `components/depth-carousel.css`, `components/obras-collage.css`, `components/mobile-tab-bar.css`, `components/artwork-loader.css`, `components/flag-ribbon.css`. The one CSS module in the tree is `components/gallery/gallery-theme.module.css`; use a module only for the 3D gallery's theme classes.
- Class composition uses `clsx` and `tailwind-merge`, and `class-variance-authority` for variant sets (declared in `package.json`).

**Imports (observed order, not enforced by a linter):**
1. Framework and Next modules: `next/navigation`, `next/cache`, `next/server`, `next/headers`.
2. Node built-ins with the `node:` prefix: `node:crypto`, `node:fs`.
3. Third-party packages: `react`, `mercadopago`, `zod`, `three`.
4. Local modules via `@/`.
5. Relative imports only within the same feature directory (`./actions`, `./page`, `./fov`).
6. Type-only imports interleaved where they are used, as above.

Real example, `app/[locale]/(site)/tienda/actions.ts`:
```typescript
'use server'

import { correoConfigured, flatShippingFee, resolvePickup, quoteSubscriptionShipping } from '@/lib/correo'

import { redirect } from 'next/navigation'
import { createHash } from 'node:crypto'
import { PreApproval } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
```
Shared pattern: `'use server'` first, then framework imports, then `@/` modules. Blank lines separate groups loosely; do not rely on them.

**`'use server'` and `'use client'`:**
- Server action modules start with `'use server'` on the first line. There are 25 such files (`app/**/actions.ts`, `lib/**/actions`). Export only async functions from them; export types from the same file only when they describe the action state.
- Client components start with `'use client'` on the first line. There are 171 such files, mostly under `components/` and `app/**`. Keep server-only imports out of them; `next/headers`, `cookies()` and `createAdminClient` must not be reached from a `'use client'` file.
- Server-only modules have no `server-only` marker package (`import 'server-only'` is not used anywhere). The boundary is enforced by which modules import `next/headers` and `lib/supabase/admin.ts`; keep it that way.

## Public-page rendering rules (from CLAUDE.md, enforced by tests)

These are conventions a new page must follow to keep CPU per visit low:

- Pages live under `app/[locale]/(site)/`. `proxy.ts` rewrites page requests to `/<locale>/…`.
- A public page listed in `lib/static-pages.ts` has an `anon/` copy at `app/[locale]/(site)/anon/<path>`. Components rendered there must read the session only through `getCurrentUser()` or `createClient()` (`lib/supabase/server.ts`), and the locale only through `getI18n()` (`lib/i18n/server.ts`). Never call `cookies()`, `headers()` or read `searchParams` directly in that tree, or the copy stops being static. Build check: `anon` routes must show `●` (static), never `ƒ`.
- Prefer `export const revalidate = <seconds>` over `export const dynamic = 'force-dynamic'`. Existing `revalidate` values: `3600` (`app/sitemap.ts`, `app/[locale]/(site)/anon/page.tsx`), `86400` (`app/[locale]/(site)/anon/club/page.tsx`, `anon/terminos-y-condiciones/page.tsx`). `force-dynamic` is used only where the page genuinely needs per-request data, e.g. `app/[locale]/(site)/page.tsx` and `app/[locale]/(site)/club/[slug]/page.tsx`.
- Server-side image rendering (`ImageResponse`, `sharp`) must go through the cache layer. `lib/cost-guards.test.ts` lists every allowed renderer in `IMAGE_RENDERERS`; adding one without listing it fails the test.
- Routes that do not read the session stay out of the `proxy.ts` matcher. `proxy.test.ts` asserts the matcher list for `/api/*`, `/monitoring/*`, `/_next/*`, static assets, and `opengraph-image` routes.

## Error Handling

**Discriminated unions for expected failures.** Pure logic returns `{ ok: true; … } | { ok: false; error: … }` with a literal string union for the error. Used in 22 source files.
```typescript
// lib/entries.ts
export type EntryChoice =
  | { ok: true; entered: string[]; main: string }
  | { ok: false; error: 'none' | 'too_many' | 'not_owned' }
```
Callers branch on `ok` and map the error code to a message. Do not throw for a validation outcome that the user can cause.

**Throwing for programmer or configuration faults.** `throw new Error(...)` (149 sites under `lib/` and `app/`) with a message that says what is missing. Messages are Spanish and user-meaningful when they can reach an admin, English is acceptable for internal invariants:
- `lib/google-sheets.ts`: `throw new Error('Faltan credenciales de la cuenta de servicio de Google.')`
- `lib/certificate-mail.ts`: `throw new Error('No hay ningún proveedor de mail configurado')`
- `lib/registro-sync.ts`: `throw new Error('El total activo no coincide con la planilla; revisar concurrencia.')`

**Server actions return state, they do not throw to the form.** The action signature is `(previousState, formData) => Promise<State>`, and the state carries an `error` code plus the typed values so the form can repopulate. Canonical example, `app/[locale]/(site)/tienda/actions.ts`:
```typescript
export type MpSubscriptionState = {
  error: 'invalid' | 'unavailable' | null
  invalid: MagazineField[]
  values: Partial<Record<MagazineField, string>>
  paymentError?: 'funds' | 'card' | 'rejected'
  subscription?: { id: string; status: 'active' | 'pending' }
}
```
Client side: `useActionState` (9 files), e.g. `app/[locale]/(site)/jurado/score-card.tsx` with initial state `{ saved: false, error: null }`. Successful money or data flows end in `redirect()` from `next/navigation` (`donar/actions.ts`, `tienda/actions.ts`).

**Honeypots and unavailable paths return the same shape.** Bots and "service not configured" both return `unavailable` rather than a distinct error; see the `formData.get('website')` check in `tienda/actions.ts`.

**API routes** return bare status responses, not bodies, for protocol errors:
```typescript
// app/api/track/route.ts
if (!names.length || names.length > TRACK_BATCH_MAX || !names.every(isFunnelEvent)) return new NextResponse(null, { status: 400 })
```
Use `NextResponse` (19 route files) or `new Response` (3 files). Human-readable bodies are used only where a person reads them (e.g. `app/api/unsubscribe/route.ts` returns Spanish text). Validate input before any Auth or database call; `app/api/track/route.test.ts` asserts that a bad `vid` never reaches `createClient`.

**Silent catches are deliberate and commented.** `catch {}` (no binding) is used where failure is acceptable, and the comment states why:
```typescript
// lib/gallery-return.ts
} catch {}  // Storage can be off or full — losing the draft is acceptable
```
Use this form only for storage, analytics, and other optional side effects. Never swallow errors on writes that carry money or ownership.

**Best-effort measurement never throws.** `lib/track-server.ts` opens with "never throws — measuring must not break the action it's measuring", and wraps its insert in `try/catch`. Follow the same rule for analytics and notification side effects.

**Logging.** There is no logging library in `package.json`. Use `console.error` with a lowercase, greppable prefix and the identifying values as separate arguments: `console.error('funnel event failed', names.join(','), error.message)` (`lib/track-server.ts`). About 47 files use this form. `console.log` is reserved for scripts under `scripts/`.

**Fallbacks for schema lag.** When a deploy can land before its migration, retry without the new column and keep the data, as `lib/track-server.ts` does for `in_app`. Comment the reason next to the retry.

## Logging and Analytics

- Client-side step tracking is `lib/track.ts` (batched, sent to `POST /api/track`). Server-side steps are `lib/track-server.ts` (`trackServer`, `recordFunnelEvents`).
- Step names are a closed set: `isFunnelEvent` in `lib/funnel.ts`. Adding a step means adding it there first; the route rejects unknown names with 400.
- Visitor IDs are validated with `VISITOR_ID_PATTERN` before use.

## Comments

**When to comment:**
- Explain *why* a rule exists, especially when it protects a cost, a money flow, or a privacy boundary. Example from `lib/entries.ts`: the comment above `resolveEntryChoice` explains the three-step fallback for the main obra, and points to the migration that defines it.
- Point to the source of truth by path: `see supabase/migrations/20260926130000_artwork_entries.sql`, `(lib/mp-subscriptions.ts)`, `(see the map or /admin/estadisticas)`.
- Record incidents that shaped the code in one or two sentences, with the date or symptom: `lib/cost-guards.test.ts` explains the October 2026 redraw bug; `lib/track-server.ts` explains the missing-column fallback.
- Do not narrate what the next line does. Do not add `// increment counter` style comments.

**Language:** Comments are mostly in English. Product copy, user-facing strings and some domain comments are in Spanish (`lib/entries.ts`, `lib/mp-subscriptions.ts`). Write new comments in English unless they describe a Spanish-only product rule.

**JSDoc/TSDoc:** Not used. Types carry the contract. A `/** … */` line is used only for an individual field whose meaning is not obvious, e.g. `LOCALE_INFO` fields in `lib/i18n/locales.ts`.

## Function Design

**Size:** Actions and route handlers are long because they validate, call services, and redirect in one place (`tienda/actions.ts` is several hundred lines). Pure helpers (`lib/entries.ts`, `lib/slug.ts`, `components/gallery/camera/fov.ts`) stay short and are the units the tests cover. When a file grows, split out pure logic into a sibling module rather than adding more branches to the action.

**Parameters:**
- Up to three positional parameters. Beyond that, use one object parameter with a destructured type, as `resolveEntryChoice({ ownedIds, requestedIds, mainId, currentMainId, limit })`.
- Optional trailing flags have defaults: `recordFunnelEvents(names, visitorId, userId, inApp = null)`.

**Return values:**
- Discriminated unions for outcomes (see Error Handling).
- `null` for "not found or not allowed" from loaders (`getCurrentUser()` returns `User | null`).
- Empty arrays rather than `null` for lists.

**Async:** `async` functions return promises of typed values; there are no callback-style APIs in new code.

## Module Design

**Exports:** Named exports everywhere except Next's required default exports (`page.tsx`, `layout.tsx`, `route.ts` handlers are named `GET`/`POST`, `opengraph-image.tsx` and `sitemap.ts` default-export their handler).

**Barrel files:** Not used. Import from the module that defines the symbol: `@/lib/supabase/server`, not `@/lib/supabase`. Keep it that way so `proxy.ts` and plain Node scripts can import a module without pulling in the rest.

**Node-script-safe modules:** Modules that must run under plain Node (scripts, `proxy.ts`) avoid `@/` imports and say so in a header comment. Examples: `lib/i18n/locales.ts` ("Kept free of `@/` imports so plain Node scripts can load it too"), `lib/static-pages.ts` ("Plain module (no `@/` imports): proxy.ts loads it."). Check this before adding an import to such a file.

**Config reads gate integrations:** Services are gated by a boolean from a config module, not by catching missing-credential errors: `isSupabaseConfigured` (`lib/supabase/config.ts`), `isMercadoPagoConfigured` (`lib/mercadopago.ts`), `isMailConfigured` (`lib/mail`), `correoConfigured()` (`lib/correo.ts`). Build and CI rely on this (see the comment in `.github/workflows/ci.yml`). New integrations follow the same pattern.

## Data Access

- Browser code uses the anon client from `lib/supabase/client.ts`; server pages and actions use `createClient()` from `lib/supabase/server.ts` (session-aware, cookie-backed); server code that must bypass row level security uses `createAdminClient()` from `lib/supabase/admin.ts` (service role). Public read paths use `lib/supabase/public.ts`.
- Admin-only writes are protected by RLS and RPCs in `supabase/migrations/`, not only by checks in TypeScript. The PGlite scenarios in `scripts/pglite/` assert those permission rules.
- Money and ownership invariants are written in SQL and tested in SQL (see TESTING.md, "Database tests").

## Validation

- Hand-written validators are the norm. `zod` is a dependency but used in only 4 source files (`lib/payments/validation.ts`, `lib/notifications/registry.ts`, `app/api/paypal/subscriptions/route.ts`, `app/api/paypal/orders/route.ts`). Use `zod` at API boundaries that accept JSON from third parties (PayPal), and plain functions elsewhere.
- Form fields are read with `formData.get(name)` and normalized with `String(... ?? '').slice(0, N)` to cap length (`tienda/actions.ts`).
- Free-text limits, phone and country codes live in `lib/phone.ts` and `lib/country-codes.ts`; reuse them.

## Internationalization

- Locales: `es` (source), `en`, `pt`, `it`, `fr`, `de`, `ru`, `pl`, `id` (`lib/i18n/locales.ts`). Spanish is the source; every other dictionary is typed against it, so a missing or extra key fails the build.
- Dictionaries: `lib/i18n/messages/<locale>.ts`, assembled in `lib/i18n/messages/index.ts`. Each file exports an object shaped like `es.ts`. Placeholders are `{name}`, plurals use `p({ one, few, many, other })` or `plural(locale, count, forms)`.
- Read strings on the server with `const { m, locale } = await getI18n()` (`lib/i18n/server.ts`) and on the client with `useI18n()` (`lib/i18n/client.tsx`). Do not hard-code Spanish in components that are translated.
- Dates and money go through `formatDayMonth`, `formatNumber`, `formatMoney` (`lib/i18n/format.ts`), never `toLocaleString` with a literal locale.
- The message-parity test (`lib/i18n/messages.test.ts`) requires every locale to use the same `{placeholders}` as Spanish.

## Example Module Layout

A typical feature follows this shape (see `lib/entries.ts` with `lib/entries.test.ts`, and `app/[locale]/(site)/donar/` with `actions.ts`, `actions.test.ts`, `page.tsx`):

```
app/[locale]/(site)/donar/
├── actions.ts          # 'use server'; reads FormData, calls providers, redirects
├── actions.test.ts     # mocks providers and next/navigation, asserts the contract
├── page.tsx            # Server Component
└── …client component   # 'use client' only when interaction needs it
lib/
├── donations.ts        # pure rules: amounts, labels, parsing
└── donations.test.ts
```

## Where to Put New Code (conventions)

- Pure rules and parsing go in `lib/<feature>.ts` with a `lib/<feature>.test.ts` beside it.
- Anything that calls Supabase, Mercado Pago, PayPal, Mail, or R2 goes behind a module in `lib/` that exposes a boolean `is…Configured` and a small set of functions, so tests can mock one module.
- Route-specific server code stays in `app/[locale]/(site)/<route>/actions.ts`. Share only what two routes use.
- Components used by one route stay in that route's folder; components used by two or more go to `components/`.

---

*Convention analysis: 2026-11-08*
