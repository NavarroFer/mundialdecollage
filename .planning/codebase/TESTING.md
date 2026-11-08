---
last_mapped_commit: 6f52dfd
---

# Testing Patterns

**Analysis Date:** 2026-11-08

## Test Framework

**Runner:**
- Vitest 5.0.1 (installed; `package.json` devDependency `"vitest": "^5.0.1"`)
- Config: `vitest.config.mts`
- Setup file: `vitest.setup.ts` (loaded for every test)
- Environment: `node` for every test. No jsdom, happy-dom, or `@testing-library/*` is installed. There are no `@vitest-environment` pragmas in the tree.

**Assertion library:**
- Vitest's built-in `expect` from `vitest`. Root-level script tests (`scripts/*.test.mts`) also use `node:assert/strict` next to Vitest's `describe`/`it`.

**Mocking:**
- Vitest's `vi` (`vi.mock`, `vi.hoisted`, `vi.fn`, `vi.stubGlobal`, `vi.stubEnv`, `vi.spyOn`, `vi.useFakeTimers`). No other mocking library is installed.

**Run commands:**
```bash
npm test                                   # Run the whole suite once (vitest run)
npx vitest run lib/entries.test.ts         # One file
npx vitest run -t "resolveEntryChoice"     # Tests whose name matches
npx vitest                                 # Watch mode (plain `vitest` without `run`)
npx vitest run --reporter=verbose          # One line per test
```

**Coverage:**
- Not configured. `vitest.config.mts` has no `coverage` block, `package.json` has no coverage script, and `@vitest/coverage-v8` / `@vitest/coverage-istanbul` are not installed. `npx vitest run --coverage` will fail until a provider is installed.
- Coverage requirement: none enforced (no thresholds, no CI step).

**Baseline (run on 2026-11-08 at commit 6f52dfd):**
```
Test Files  177 passed (177)
Tests       1113 passed (1113)
Duration    ~3 s
```
Known non-failing noise in the output: a Vite warning about a dynamic import in `lib/cron.test.ts`, a Three.js `require("three")` deprecation warning from the gallery tests, and `react-simple-maps` sourcemap warnings. None of them affects results.

**Configuration (`vitest.config.mts`):**
```typescript
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
```
- `@` resolves to the repository root, the same alias as `tsconfig.json`. Tests use `@/lib/...` and `@/components/...`.
- `.claude/**` is excluded because agent worktrees are full checkouts with their own tests.
- Default include pattern: `**/*.{test,spec}.?(c|m)[jt]s?(x)`. This picks up `proxy.test.ts` at the root, `scripts/*.test.mts`, `data/artworks.test.ts`, and every colocated test.

**Global setup (`vitest.setup.ts`):**
```typescript
// A placeholder Next's compiler replaces (it throws when imported as is)
vi.mock('next/root-params', () => ({ locale: async () => undefined }))

// unstable_cache needs Next's incremental cache; tests read loaders straight through
vi.mock('@/lib/public-data-cache', () => ({
  cachedPublicData: <T>(fn: T) => fn,
  refreshPublicData: vi.fn(),
  refreshArtworkData: vi.fn(),
  refreshExhibition: vi.fn(),
}))
```
Any test that imports a module using `cachedPublicData` gets the uncached loader automatically. Do not re-mock these in individual tests unless the test is about caching.

## Test File Organization

**Location:** Colocated. Every test sits in the same directory as its subject. There is no `__tests__/` directory, no `fixtures/`, no `__mocks__/`, and no factory folder.

**Naming:**
- `<subject>.test.ts` for logic, `<subject>.test.tsx` for React output, `<subject>.test.mts` for root-level scripts.
- The subject name matches the source file: `lib/slug.ts` → `lib/slug.test.ts`, `lib/cron.ts` → `lib/cron.test.ts`, `app/api/track/route.ts` → `app/api/track/route.test.ts`, `app/[locale]/(site)/donar/actions.ts` → `actions.test.ts`.
- Test files with a dotted suffix test one concern of a larger module: `lib/mp-subscriptions.recover.test.ts`.

**Distribution (177 files):**

| Location | Test files | What they cover |
|---|---|---|
| `lib/` | 117 | Pure rules, payment and mail logic, i18n, cost guards, static-page list |
| `components/` | 38 | 3D gallery pure modules (`components/gallery/**`), admin stat helpers, a few React output tests |
| `app/` | 17 | Server actions (`actions.test.ts`), API routes (`route.test.ts`), page components (`page.test.tsx`), `robots.test.ts` |
| `scripts/` | 3 | Registro parsing and Apps Script logic (`scripts/*.test.mts`) |
| `data/` | 1 | `data/artworks.test.ts` (gallery hanging geometry) |
| root | 1 | `proxy.test.ts` (matcher and rewrite) |

**Structure:**
```
lib/
├── entries.ts
├── entries.test.ts
├── track-server.ts          # no test: exercised through route.test.ts with a mock
└── …
components/gallery/
├── camera/fov.ts
├── camera/fov.test.ts
└── …
app/api/track/
├── route.ts
└── route.test.ts
```

## Test Structure

**Suite organization.** One `describe` per exported function or route, one `it` per behavior. Test names are full English sentences in the present tense, describing what the code does for the user, not how it works internally:

```typescript
// lib/slug.test.ts
describe('slugify', () => {
  it('lowercases and dashes plain ascii', () => {
    expect(slugify('Mateo Alviani')).toBe('mateo-alviani')
  })
  it('strips accents instead of dropping the letter', () => {
    expect(slugify('Sofía Ramírez')).toBe('sofia-ramirez')
  })
})
```

```typescript
// lib/entries.test.ts
describe('resolveEntryChoice', () => {
  const ownedIds = ['a', 'b', 'c']
  it('makes the single free choice the main obra', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['b'], currentMainId: 'a', limit: 1 })).toEqual({
      ok: true, entered: ['b'], main: 'b',
    })
  })
})
```

Test names in the repo are written as behavior claims: `'keeps AI training crawlers off the whole site'` (`app/robots.test.ts`), `'rejects malformed visitor IDs before doing Auth or database work'` (`app/api/track/route.test.ts`), `'only returns the sign-in screen to anonymous visitors, without fetching works'` (`app/[locale]/(site)/galeria-3d/page.test.tsx`).

**Patterns used across files:**
- Use `beforeEach` with `vi.clearAllMocks()` or `vi.resetAllMocks()` to reset shared mock state. `resetAllMocks` also clears implementations, so set them again in the test.
- `afterEach(() => vi.useRealTimers())` after any fake-timer test.
- Assertions that check several fields at once use `expect.objectContaining` and `expect.stringMatching`, so a test documents the fields that matter and ignores the rest (see `app/[locale]/(site)/donar/actions.test.ts`).
- Failure messages: `expect(value, 'context').toBe(...)` is used when a loop checks many inputs, e.g. `expect(matches(url), url).toBe(true)` in `proxy.test.ts`.
- Silence expected `console.error` output with a spy: `vi.spyOn(console, 'error').mockImplementation(() => {})` (`donar/actions.test.ts`).
- Loops over a table of inputs are used for "must not do X" lists: the matcher in `proxy.test.ts` runs `for (const url of [...]) expect(matches(url), url).toBe(false)`.

**Setup and teardown:** Mocks are declared at the top of the file, before the import of the module under test. Vitest hoists `vi.mock` calls above imports automatically, but `vi.hoisted` is needed when the mock factory references variables:

```typescript
// app/[locale]/(site)/donar/actions.test.ts
const mocks = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  redirect: vi.fn(),
  configured: { value: true },
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
import { startDonation } from './actions'   // imported after the mocks

beforeEach(() => {
  vi.resetAllMocks()
  mocks.configured.value = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
```

## Mocking

**Framework:** Vitest `vi`. There is no `__mocks__` directory; every mock is declared inline in the test that needs it. `vi.mock` is used in 44 test files.

**Mocking an external integration (the dominant pattern).** Mock the module that wraps the integration, not the SDK underneath. Pair the mock with a mutable `configured` flag exposed through a getter, so one test can flip a feature off:

```typescript
// app/[locale]/(site)/donar/actions.test.ts
vi.mock('@/lib/payments/providers/mercadopago', () => ({
  mercadoPago: {
    id: 'mercadopago',
    get isConfigured() { return mocks.configured.value },
    createCheckout: mocks.createCheckout,
  },
}))
```

```typescript
// lib/cron.test.ts (also works for the config-gated Supabase client)
const mail = vi.hoisted(() => ({ configured: true, sendMail: vi.fn() }))
vi.mock('@/lib/mail', () => ({
  get isMailConfigured() { return mail.configured },
  sendMail: mail.sendMail,
}))
```

```typescript
// app/api/track/route.test.ts
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/track-server', () => ({ recordFunnelEvents: mocks.record }))
```

**Mocking Supabase Auth in proxy-level tests.** `proxy.test.ts` mocks the SSR client and the config, then runs the real `proxy` function on a real `NextRequest`:
```typescript
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn(async () => ({ data: { user: null } })) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({ auth: { getUser } })) }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
```
The test then asserts that a visitor without a session never calls `getUser` (`expect(getUser).not.toHaveBeenCalled()` in the "doesn't touch Supabase" case).

**Mocking Next.js:**
- `next/navigation` for `redirect`: `vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))`. Since `redirect` throws in production, tests assert the call instead of the throw.
- `next/root-params` is mocked globally in `vitest.setup.ts`.
- Server components are called as plain functions: `const result = await Page()` (`galeria-3d/page.test.tsx`), then the element tree is inspected through `.type` and `.props`. Mock child components by name as strings so they show up in the tree: `vi.mock('@/components/stamp-visit', () => ({ StampVisit: 'stamp-visit' }))`.

**Mocking browser and network globals:**
- `fetch`: `vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(original))))` (8 files, e.g. `app/api/img/route.test.ts`, which also stubs 404 and 402 responses).
- `React` as a global for a component that uses it without importing: `vi.stubGlobal('React', React)` (`app/[locale]/(site)/admin/estadisticas/income-section.test.tsx`).
- Environment variables: `vi.stubEnv('CLUB_OPEN', 'on')` (15 files). Reset in `afterEach` or by the next test that sets it: `app/[locale]/(site)/mi-galeria/editar/actions.test.ts` sets `CLUB_OPEN` to `'on'` and back to `''`.
- Timers: `vi.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00Z'))` (`lib/gallery-artworks.test.ts`, `lib/track.test.ts`). Only 3 test files use fake timers. Prefer passing `now` as an argument to pure functions over faking the clock.

**Spies:** `vi.spyOn(console, 'error')` to silence and count error logs; `vi.spyOn(globalThis, ...)` is available but not used.

**What to mock:**
- Anything that talks to Supabase, Mercado Pago, PayPal, Resend/Brevo mail, Google Sheets, R2, Correo Argentino, or the Anthropic SDK.
- The `is…Configured` gates, to force the configured and unconfigured paths.
- `next/navigation`, `next/headers` (through the function that reads it), and `next/cache` when a test needs the call but not the side effect.
- The data loader a page calls (`@/lib/gallery-artworks`, `@/lib/supabase/server`) so the page logic runs without a database.

**What NOT to mock:**
- Pure rules and parsers. `lib/entries.ts`, `lib/slug.ts`, `lib/funnel.ts`, `lib/i18n/format.ts` are tested directly with real inputs.
- The Next.js request and response classes. Tests build a real `NextRequest` and read a real `Response` (`app/api/track/route.test.ts`, `proxy.test.ts`).
- `site` configuration (`lib/site.ts`). Several tests read real values from it (e.g. `entryLimit` tests use `site.entries.paidLimit`).
- Locale dictionaries. `lib/i18n/messages.test.ts` checks the real dictionaries.

## Fixtures and Factories

There are no fixture files or factory functions. Each test builds the input it needs inline, usually with a small helper at the top of the file:

```typescript
// app/api/track/route.test.ts
const vid = '550e8400-e29b-41d4-a716-446655440000'
function request(payload: unknown, cookie = '') {
  return new NextRequest('https://site.test/api/track', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(payload),
  })
}
```

```typescript
// app/[locale]/(site)/donar/actions.test.ts
function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}
```

**Rules for test data:**
- Use real-looking Spanish or Argentine data where the domain uses it (`'Sofía Ramírez'`, `'Mateo Alviani'`, `'Obra 1'`, `'foto.jpg'`), and fixed UUIDs for IDs (`'550e8400-e29b-41d4-a716-446655440000'`).
- Use `https://site.test` or `https://mundial.test` as the origin in tests; never a production domain.
- Email addresses in tests use reserved domains: `a@x.invalid` in PGlite scenarios, `example.com` in script tests.

**Location:** Inline in each test file. If the same helper appears in three or more files, move it to a sibling module named for what it builds (for example `lib/<feature>.test-helpers.ts`), not to a global `fixtures/` folder. No such module exists today.

## Coverage

**Requirements:** None enforced. There are no coverage thresholds and no CI coverage step.

**View coverage:** not configured. To add it, install a provider and set `coverage` in `vitest.config.mts`:
```bash
npm install --no-save @vitest/coverage-v8
npx vitest run --coverage
```

**Where coverage is strong:**
- Pure domain rules: entries, pricing, campaign schedules, country breakdowns, slugs, phones, names, receipts, referrals, finalists.
- Payment and webhook logic: `lib/payments/**`, `lib/mercadopago-signature.test.ts`, `lib/mp-subscriptions*.test.ts`, `lib/payments/paypal/*.test.ts`.
- Access and ownership in server actions: `app/[locale]/(site)/admin/obras/actions.test.ts`, `galeria-3d/wall-actions.test.ts`, `mi-galeria/editar/actions.test.ts`, `onboarding/actions.test.ts`, `tienda/actions.test.ts`.
- API routes: the Mercado Pago webhook, PayPal return, track, img, gallery attention, artworks surprise, and monitoring routes have a `route.test.ts`. **Gaps:** `app/api/paypal/webhook/route.ts`, `app/api/paypal/orders/[id]/route.ts`, and `app/api/paypal/subscriptions/route.ts` have no route test, though they move money (see Priority gaps below).
- The 3D gallery's pure modules: camera (`fov`, `edgeTurn`), navigation (`aim`, `path`), player (`jump`, `spawn`), presence (`poses`, `protocol`, `labels`), vinyl and arcade state, world layouts (`world/mar/layout`, `world/roomsData`, `world/people/*`).
- Cost and privacy guard rails: `lib/cost-guards.test.ts` (image renderers), `proxy.test.ts` (matcher), `lib/static-pages.test.ts`, `app/robots.test.ts`.

**Where coverage is thin or absent:**
- React components beyond a few render tests. Only 5 `.test.tsx` files exist (`app/[locale]/(site)/admin/estadisticas/income-section.test.tsx`, `components/admin/submissions-gallery.test.tsx`, `components/ui/call-chip.test.tsx`, `app/[locale]/(site)/galeria-3d/page.test.tsx`, `lib/artwork-share-image.test.tsx`) against about 190 non-test `.tsx` files under `components/`, `app/` and `lib/`.
- Client-side interactions: no test drives a form, click, or drag. `dnd-kit` ordering, the donation form, the subscription checkout, and the map explorer have no interaction tests.
- The 3D renderer itself (`components/gallery/Scene.tsx`, `Game.tsx`, `ClubGame.tsx`) is not rendered in tests. Logic that feeds it is extracted and tested instead.
- Route-level end-to-end flows (sign-in, checkout, onboarding) have no automated test.

## Test Types

**Unit tests (the bulk, 1113 cases):**
- Scope: one pure function or one module with its collaborators mocked.
- Approach: direct calls with real inputs; mocks only at module boundaries.
- Example: `lib/cron.test.ts` covers the bearer-secret check (`isAuthorizedCron`), the 401 short-circuit (`cronRoute`), dry-run flags, and that `runCronJobs` keeps going after one job throws.

**Server-action and route tests:**
- Scope: the server contract: validation, permission checks, which provider is called with what, what is recorded, and where the user is redirected.
- Approach: build a `FormData` or `NextRequest`, call the exported `POST`/action, assert on mocks and the returned status or state.
- Examples: `app/api/track/route.test.ts`, `app/[locale]/(site)/donar/actions.test.ts`, `app/[locale]/(site)/tienda/actions.test.ts`.

**Page tests:**
- Scope: what a page returns for anonymous and signed-in visitors.
- Approach: call the page function, inspect the returned element tree (`.type`, `.props`). Example: `galeria-3d/page.test.tsx` asserts that an anonymous visitor gets `gallery-sign-in` and that `getGalleryArtworks` is not called.

**Static-render tests (React output):**
- Scope: the markup a small presentational component produces.
- Approach: `renderToStaticMarkup(<Component … />)` from `react-dom/server`, then assert on the HTML string. Example: `components/ui/call-chip.test.tsx`.

**Cost and structure guard tests:**
- Scope: rules that protect the Vercel CPU budget and the privacy boundary; these tests read source files from disk.
- Approach: `readdirSync` / `readFileSync` over `app/`, `lib/`, `components/`, and assert on the set of files that match a pattern.
- Examples: `lib/cost-guards.test.ts` (every file that calls `new ImageResponse(` or imports `sharp` must be listed in `IMAGE_RENDERERS` with how it avoids redrawing; `lib/r2.ts` and `lib/share-image-cache.ts` must not set `cache: 'no-store'`). `proxy.test.ts` checks which URLs the `proxy.ts` matcher runs for.
- When a new renderer is added and the test fails, the fix is to cache its output (R2 via `lib/share-image-cache.ts`, or ISR) and add it to `IMAGE_RENDERERS`, not to edit the test to pass.

**Dictionary tests:**
- `lib/i18n/messages.test.ts` requires every locale to use the same `{placeholders}` as Spanish, checks plural forms, and checks date formatting in each language.
- `lib/i18n/locales.test.ts` checks language preference order, country-to-language mapping, and the English fallback.

**Script tests (`scripts/*.test.mts`):**
- Run by the same `npm test`. Use `node:assert/strict` inside a Vitest `it`. Examples: `scripts/registro.test.mts` parses the curated registro sheet and checks Drive file IDs; `scripts/registro-image-fingerprint.test.mts`; `scripts/apps-script-registro.test.mts`.

**Database tests:** There are two families. Neither runs in CI and neither is in `npm test`.

1. **PGlite scenarios (`scripts/pglite/`)**: an embedded Postgres that applies every migration in `supabase/migrations/` in order and then runs role-by-role scenarios. Nothing needs a running Supabase.
   - Setup:
     ```bash
     npm install --no-save @electric-sql/pglite      # not in package.json on purpose
     node scripts/pglite/harness.mjs                 # applies all migrations, lists the ones that fail
     node scripts/pglite/harness.mjs 20261009010000  # stop before a given migration
     node scripts/pglite/club-roles.mjs              # one scenario
     ```
   - `harness.mjs` creates the Supabase pieces the migrations rely on (roles `anon`, `authenticated`, `service_role`; schemas `auth`, `storage`, `realtime`; `auth.uid()`, `auth.jwt()`, `auth.role()`; `storage.objects`), then applies each `.sql` file with `db.exec`. Per the header comment, `20261009010000_home_stats_broadcast.sql` is the one that fails, because `realtime.topic()` is not stubbed, and nothing the Club touches depends on it.
   - Scenario scripts print one line per check, e.g. `anon sees draft gallery   : []`, `other edits gallery : ERROR: …`. They contain no `assert` and no `process.exit`, so a wrong result does not fail anything: read each printed line and compare it with what the role should be allowed to do.
   - Scripts: `club-roles.mjs` (who can read and edit what), `club-artworks.mjs`, `club-audience.mjs`, `club-boards.mjs`, `club-bonus-stamps.mjs`, `club-contact.mjs`, `club-courtesy.mjs`, `club-hangings.mjs`, `club-home.mjs`, `club-probe.mjs`, `club-public-read.mjs`, `club-samples.mjs`, `club-stamps.mjs`, `club-stats.mjs`, `club-weekly.mjs`, `public-profile-contacts.mjs`, `store-regression.mjs`.
   - Use it before shipping any new migration. `docs/club-del-mundial-galerias-virtuales.md` records the Club migrations tested this way.

2. **Migration checks against the real project (`scripts/test-*-db.mts`, 10 files)**: each script reads the migration file, builds one SQL transaction that applies it, runs assertions in a `DO $$` block, prints `passed` and the check list. The registro script ends with `ROLLBACK`, and the club-galleries header says it is "always rolled back".
   - Run: `node --env-file=.env.local scripts/test-registro-db.mts <json>` (the registro script takes a JSON file of entries; the others read their own fixtures from the repo).
   - The script sends the SQL to the Supabase Management API (`POST https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query`) with `SUPABASE_ACCESS_TOKEN`. **That is the production project.** The transaction is rolled back, but it runs against production, so run these only when the owner expects it.
   - Files: `scripts/test-club-galleries-db.mts`, `test-contact-sanitize-db.mts`, `test-legacy-publication-db.mts`, `test-optional-title-db.mts`, `test-registro-db.mts`, `test-registro-email-reconciliation-db.mts`, `test-registro-instagram-db.mts`, `test-registro-name-cleanup-db.mts`, `test-registro-titles-db.mts`, `test-relink-orphans-db.mts`.

**E2E tests:** Not used. No Playwright or Cypress test suite exists in the repository. `playwright-core` is a devDependency used by build scripts, not by tests:
- `scripts/avatars/build.mjs` (imports `chromium` from `playwright-core`) renders the avatar set.
- `scripts/build-bases-pdf.mts` renders the contest bases PDF; its header says `npm i --no-save playwright-core` because it is not needed on Vercel.
Performance measurement is done by hand against a running site (the recipe is kept outside the repo); there is no committed perf test.

## Common Patterns

**Async testing:**
```typescript
it('sends the donor to Mercado Pago for the amount they tapped', async () => {
  mocks.createCheckout.mockResolvedValue({ url: 'https://mp/checkout', id: 'pref' })
  await startDonation(initial, form({ amount: '10000', from: 'gallery' }))
  expect(mocks.redirect).toHaveBeenCalledWith('https://mp/checkout')
})
```
Await the action or route call and assert on the mocks afterwards. Use `mockResolvedValue` for promises and `mockRejectedValue` for failures.

**Error and failure testing:**
```typescript
it('rejects malformed visitor IDs before doing Auth or database work', async () => {
  expect((await POST(request({ name: 'home_view', vid: 'bad' }, 'sb-abc-auth-token=session'))).status).toBe(400)
  expect(mocks.createClient).not.toHaveBeenCalled()
  expect(mocks.record).not.toHaveBeenCalled()
})
```
Assert the status or returned error code, then assert that the side effect did not happen. For discriminated-union results, assert the whole object with `toEqual` so the error code is checked too:
```typescript
expect(resolveEntryChoice({ ownedIds, requestedIds: ['z'], limit: 1 })).toEqual({ ok: false, error: 'not_owned' })
```

**Table-driven checks:**
```typescript
for (const url of ['/api/img', '/api/track', '/robots.txt']) {
  expect(matches(url), url).toBe(false)
}
```
Use loops over arrays for "every item in this list must / must not" rules, and pass the item as the assertion message.

**Pure-function tests for UI logic:** When a component has logic (camera field of view, aim, layout, avatar motion), move it into a sibling module with no React or Three.js imports and test it directly. Examples: `components/gallery/camera/fov.ts` with `fov.test.ts`, `components/gallery/navigation/aim.ts` with `aim.test.ts`, `components/gallery/world/people/avatarMotion.ts` with `avatarMotion.test.ts`. The tests use plain numbers for aspect ratios, times, and coordinates.

**Time-dependent logic:** Pass `now` in, or fake the system time for the duration of the test. Example from `lib/gallery-artworks.test.ts`:
```typescript
vi.useFakeTimers().setSystemTime(new Date('2026-09-23T08:59:59-03:00'))
// assert the pre-cutover result, then:
vi.setSystemTime(new Date('2026-09-23T09:00:00-03:00'))
```
Always restore with `vi.useRealTimers()` in `afterEach`.

## Adding a New Test

1. Put the file next to the module: `lib/<feature>.test.ts`.
2. Import `describe, expect, it` (and `vi`, `beforeEach` when needed) from `vitest`.
3. For server actions and routes, mock `@/lib/supabase/config` and `@/lib/supabase/server` (or `@/lib/supabase/admin`) and the provider wrapper, then call the export with a real `FormData` or `NextRequest`.
4. For a new image renderer, expect `lib/cost-guards.test.ts` to fail until the file is listed in `IMAGE_RENDERERS` with how it avoids redrawing.
5. For a new public page, add it to `lib/static-pages.ts` and the matching `anon/` copy; `lib/static-pages.test.ts` checks both.
6. For a new locale key, add it to every `lib/i18n/messages/<locale>.ts` with the same placeholders as Spanish; `lib/i18n/messages.test.ts` checks it.
7. For a migration, run it through `scripts/pglite/harness.mjs` first, then add or extend a scenario in `scripts/pglite/`.
8. Run `npm test`, then `npm run lint`, then `npx tsc --noEmit`.

## Priority Gaps

Ordered by risk. Each is a place where a regression would move money, expose data, or break the Club without a test noticing:

1. **PayPal webhook and order routes** (`app/api/paypal/webhook/route.ts`, `app/api/paypal/orders/[id]/route.ts`, `app/api/paypal/subscriptions/route.ts`). `lib/payments/providers/paypal.test.ts` and `lib/payments/paypal/handlers.test.ts` cover the handlers, but not the HTTP entry points that verify and dispatch.
2. **Money-moving RPCs** in `supabase/migrations/`. They are covered only by the manual PGlite scenarios and the `test-*-db.mts` scripts, which are not in CI.
3. **Client interactions** for checkout forms (`components/mp-subscription-checkout.tsx`, `components/paypal-subscription-checkout.tsx`, `components/donation-form.tsx`) and the onboarding/admin forms built on `useActionState`.
4. **Gallery renderer wiring** (`components/gallery/Scene.tsx`, `Game.tsx`, `ClubGame.tsx`): the pure modules are tested, the composition is not.

---

## CI Gates

Source: `.github/workflows/ci.yml`, job `check`, runs on every push to `main` and every pull request, Node 22, `npm ci` first:

1. `npm run lint` (ESLint, next core-web-vitals)
2. `npx next typegen`
3. `npx tsc --noEmit`
4. `npm test` (Vitest, the suite described above)
5. `npm run build` (Next build with Supabase and Mercado Pago env vars deliberately absent, so the "not configured" paths run)

The `migrate` job (`.github/workflows/supabase-migrations.yml`) runs only after `check` passes on `main`, and applies migrations with `supabase db push --remote`. The `deploy` job then triggers the Vercel deploy hook. Database scripts in `scripts/pglite/` and `scripts/test-*-db.mts` are not part of CI.

Because CI has no database, a migration is not tested by CI. The PGlite harness is the only pre-merge check for SQL.

---

*Testing analysis: 2026-11-08*
