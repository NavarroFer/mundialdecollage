---
last_mapped_commit: 6f52dfd
---

# Codebase Concerns

**Analysis Date:** 2026-11-08

## Vercel CPU Budget (highest priority)

The site runs on Vercel Hobby: 4 hours of Active CPU per 30 days for the whole team (CLAUDE.md "Vercel CPU budget"). Every item below is a place where a request can cost Function CPU that a CDN hit or a cached render would avoid.

**Scheduled registro sync may consume most of the budget on its own:**
- Problem: `vercel.json` runs `/api/cron/registro` every 2 hours (`0 */2 * * *`), i.e. 12 runs a day. `app/api/cron/registro/route.ts` allows up to 300 s per run and budgets 220 s for image work (see Fragile Areas).
- Arithmetic: 12 runs x 300 s = 60 min of wall time per day at the ceiling. The budget is about 8 min of Active CPU per day (4 h / 30 days). Sharp image work is CPU-bound, so a run that does real image work can burn a large share of the budget even when nothing changed.
- Files: `vercel.json`, `app/api/cron/registro/route.ts`, `lib/registro-sync.ts`, `lib/registro-image-fingerprint.ts`
- Fix approach: Measure Active CPU per cron run in the Vercel usage dashboard (Vercel MCP `get_runtime_logs` or usage). Make the registro job a no-op when the sheet fingerprint is unchanged before any image work. Lower the frequency or move it to a manual trigger if the sheet rarely changes.

**Proxy runs on every page request, including CDN-served anonymous copies (verify):**
- Problem: `proxy.ts` matches every page path (matcher at `proxy.ts:101`) and computes the rewrite to `/<locale>/anon/...` on each request. Whether a CDN HIT for `/` or `/obras/<slug>` still invokes the proxy function has not been confirmed.
- Files: `proxy.ts`, `lib/static-pages.ts`, `proxy.test.ts`
- Fix approach: Run the CLAUDE.md check (`curl -D - <url>` twice, look for `x-vercel-cache: HIT`) on `/`, `/obras/<slug>`, `/galeria-3d`. Check the Vercel function invocation count for the proxy against page views. If the proxy is invoked on HITs, consider a matcher that excludes paths handled entirely by static rewrites, or a `next.config` rewrite for anonymous visitors that does not need the proxy.

**Public pages rendered per request with no anonymous copy:**
- Problem: These pages are public but not in `STATIC_PAGES` (`lib/static-pages.ts`), so each visit is a Function run:
  - `app/[locale]/(site)/tienda/page.tsx`: calls `headers()` unconditionally (`x-vercel-ip-country`) and reads `searchParams` (`desde`, `envio`). No `revalidate`, no `s-maxage`. Every visit to the store is a Function run.
  - `app/[locale]/(site)/museomar/page.tsx`: `export const dynamic = 'force-dynamic'`, re-renders the gallery per request, no anonymous copy.
  - `app/[locale]/(site)/jurado/page.tsx`, `app/[locale]/(site)/taller/inscripcion/page.tsx`: read `searchParams`. Check whether they are reached by anonymous visitors in practice.
- Fix approach: For `tienda`, move the country-dependent price and shipping choice into a client component (or a small CDN-cached JSON endpoint keyed by country), drop `headers()` and `searchParams` from the server render, then add `/tienda` to `STATIC_PAGES` with an `anon/` copy. For `museomar`, add an anonymous copy like `anon/galeria-3d` with `revalidate` set.

**`force-dynamic` on pages that could be cached:**
- Files and reason, from `app/[locale]/(site)/`:
  - `page.tsx` (home): has an anon copy, so only personal visitors pay. Acceptable.
  - `obras/[slug]/page.tsx`: comment says slugs come from live submissions. Anonymous visitors are served `anon/obras/[slug]` (`revalidate = 86400`), but any visitor with a referral (`?ref=` or the 30-day `REFERRAL_COOKIE`) renders the page per request (`showsInvite` in `proxy.ts`). Artist-invited visitors therefore cost a Function run on every obra page view for 30 days.
  - `galeria-3d/page.tsx`, `club/[slug]/page.tsx`, `artistas/[slug]/page.tsx`: have anon copies. Same personal-visitor trade-off.
  - `ar/[slug]/page.tsx`: no anon copy; AR card page per request.
  - `[...missing]/page.tsx`: `force-dynamic` on the catch-all 404. Every unknown URL (including scanner traffic) is a Function run. The comment says this is to avoid cached made-up URLs; a `notFound()` with a short `s-maxage` on the response would avoid the cost.
- Fix approach: Prefer `revalidate` over `force-dynamic` where the page reads no request data. For `[...missing]`, decide between static 404 caching and rate limiting at the CDN (Vercel Firewall rule; see `project_vercel_firewall` memory: Hobby allows 3 rules and 1 rate limit).

**Route handlers that return `no-store` on every request:**
- `app/api/artworks/surprise/route.ts` (line 18): a 307 to a random obra, `Cache-Control: no-store`, every click reads `getFinalists()` and runs a Function. CLAUDE.md asks that data the client can fetch later come from a CDN-cached endpoint. The random pick can run in the browser from `app/api/obras/route.ts` (already `revalidate = 3600`, CDN-cached list).
- `app/api/shipping/quote/route.ts` and `app/api/shipping/branches/route.ts` (lines 15, 12, and error paths): `no-store`. These depend on the plan and are small, but each call is a Function run. Verify call frequency from `tienda`.
- `app/api/stamps/route.ts` (`private, no-store`): user-specific, called from `components/world-map.tsx`, `components/stamp-visit.tsx`, `components/stamp-album-client.tsx`. Acceptable for signed-in users; confirm it is not called for anonymous visitors on the map.

**Image drawing on request, allowed but not cached by CDN:**
- Problem: `lib/cost-guards.test.ts` allowlists `lib/certificate.tsx` and `lib/ar/print-cards.tsx` as "on request by the artist (robots.txt keeps crawlers off)". The two route handlers that draw them respond with `private, max-age=3600`, which the CDN does not share:
  - `app/[locale]/(site)/obras/[slug]/certificado/route.ts` (line 56, 66)
  - `app/[locale]/(site)/ar/[slug]/tarjetas/route.ts` (line 49)
- Risk: `app/robots.ts` (line 19) disallows `/obras/*/certificado` but not `/ar/*/tarjetas`. Whether these routes require the artist's session or only a slug/token was not confirmed in this pass. If only a slug is needed, anyone can make the Function draw a card with sharp.
- Fix approach: Confirm the auth check in both handlers. Cache the drawn output in R2 via `lib/share-image-cache.ts` (same pattern as the obra share image), and add `ar/*/tarjetas` to the robots disallow list.

**Image pipeline cost on cache misses:**
- Files: `app/api/img/route.ts`, `lib/image-loader.ts`, `lib/r2.ts`
- Status: Mitigated. Versioned photos are cached for a year (`IMMUTABLE_CACHE`), legacy mutable paths for a day (`MUTABLE_CACHE`), and R2 keeps originals and derivatives so a CDN miss avoids sharp when the version is known.
- Remaining risk: every legacy (mutable) miss issues a `HEAD` to Supabase (`cache: 'no-store'`, line ~52) and a sharp resize per width. A deploy empties the CDN cache, so the first visit to each size after a deploy costs sharp time for each width.
- Fix approach: Keep batching deploys (`feedback_batch_deploys`). Warm the most common widths after deploy, or raise the mutable TTL once the legacy photos are re-uploaded with versioned names.

**Unauthenticated write endpoints without rate limiting:**
- Files: `app/api/track/route.ts` (POST, anonymous events in batches up to `TRACK_BATCH_MAX`), `app/api/gallery/attention/route.ts` (POST, origin-checked, writes with the service role key)
- Problem: No rate limiting was found in `app/api`, `lib` or `proxy.ts` (`grep -rln "rateLimit|ratelimit"` returned only translation strings). A scripted client can drive Function invocations and database writes. `api/track` has no origin check; `api/gallery/attention` does.
- Fix approach: Add an origin check and a per-visitor-id limit to `api/track` (the visitor id is already validated by `VISITOR_ID_PATTERN`). The Vercel Firewall rate-limit rule is the only rate limit available on Hobby (1 rule), so reserve it for the most abusable path.

## Tech Debt

**Large component and action files (carried forward; sizes not re-measured in this pass):**
- `components/depth-carousel.tsx`, `components/admin/email-block-editor.tsx`, `app/[locale]/(site)/onboarding/onboarding-form.tsx`, `app/[locale]/(site)/admin/obras/page.tsx`
- `app/[locale]/(site)/admin/obras/actions.ts` (profile visibility, legacy publishing, image fetch in one file), `app/[locale]/(site)/admin/campanas/actions.ts` (translation, templates, batch send)
- Impact: Hard to test in isolation; render cycles in long components.
- Fix approach: Split by responsibility; move validation and retry logic into `lib/` modules that have tests (the pattern already used by `lib/registro-sync.ts`).

**Translation messages as TypeScript objects:**
- Files: `lib/i18n/messages/{en,es,pt,it,fr,de,ru,pl,id}.ts`, loaded through `lib/i18n/messages.ts`.
- Impact: All nine locales ship in the server and client bundles through the import graph; any copy change is a code change and a deploy (and, per the CPU budget, a deploy empties the CDN cache).
- Fix approach: Keep as is for now. If copy changes become frequent, move to JSON per locale and load only the active one in the server render.

**Two copies of every public page:**
- Files: `lib/static-pages.ts` (12 entries) and each `app/[locale]/(site)/anon/<path>/page.tsx`. Each anon page re-exports the real page and calls `renderAsAnonymous()` (`lib/render-mode.ts`).
- Problem: A change in the page must not read cookies, headers or `searchParams`, or the anonymous copy silently stops being static (CLAUDE.md). The only guard is `lib/static-pages.test.ts`, which checks that the copies exist, not that they read nothing personal.
- Fix approach: Add a test that builds (or statically inspects) the anon routes and fails when they show `ƒ` instead of `●` after `next build`.

**Two sources of truth for admin access:**
- Problem: Admin access is an email allowlist (`ADMIN_EMAILS` in `lib/admin.ts`), checked in `app/[locale]/(site)/admin/layout.tsx` and again in server actions. No role column or claim.
- Fix approach: Keep the allowlist but route every admin action through one helper (`assertIsAdmin` pattern) and test that helper.

**Stale TODOs:**
- `lib/site.ts` line 7: Instagram handle or URL still a TODO.
- `lib/site.ts` line 27: price "to be decided"; checkout hook for a later payment provider.

**Repository hygiene:**
- Tracked archives in `tmp/`: `tmp/mdc-brand.tgz`, `tmp/mdc-carrusel.tgz`, `tmp/mdc-full.tgz` (about 8 MB together), `tmp/obras-gap.mts`. `.gitignore` ignores `/output/` but not `tmp/`.
- Tracked `legacy-submissions-import.txt` (223 lines) at the repo root. Its contents were not read in this pass; if it holds participant personal data, it should not be in git history (review before the next public push).
- Tracked audio and video in `public/` (about 19 MB of `public/music/*.mp3` and `public/cancion.mp3`, `public/header.mp4` about 2.5 MB). These cost bandwidth, not Function CPU, but they are large for a repo.
- Fix approach: Add `tmp/` to `.gitignore` and `git rm --cached` the archives; move audio to Supabase Storage or R2.

## Known Bugs and Gaps

**Layout-level errors have no boundary:**
- Symptoms: Errors thrown in `app/[locale]/layout.tsx` or outside the `(site)` group are not caught by `app/[locale]/(site)/error.tsx`.
- Files: `app/[locale]/(site)/error.tsx`, `app/[locale]/(site)/not-found.tsx` (both exist). No `app/global-error.tsx` was found.
- Fix approach: Add `app/global-error.tsx` (required by Next for root-layout errors).

**Brevo webhook accepts its secret in the URL:**
- Files: `lib/mail/events.ts` (line ~91): `verify` accepts `?token=<BREVO_WEBHOOK_SECRET>` as well as a bearer header.
- Symptoms: The secret can appear in Vercel request logs, provider dashboards and any proxy logs.
- Fix approach: Require the bearer header only, and configure Brevo to send it, once the provider supports it.

**Placeholder text in admin UI:**
- `app/[locale]/(site)/admin/obras/page.tsx` line 377 contains an example row with a fake Drive URL (`XXXX`). It is example text in a help string, not a functional bug; confirm it is not rendered as data.

## Security Considerations

**Webhook verification (previously reported, now fixed):**
- Mercado Pago: `app/api/mercadopago/webhook/route.ts` (lines 50-67) refuses unsigned notifications when `MERCADOPAGO_WEBHOOK_SECRET` is missing, and rejects bad signatures.
- Mail providers: `lib/mail/webhook.ts` refuses everything when the secret is unset (`RESEND_WEBHOOK_SECRET`, `BREVO_WEBHOOK_SECRET`). Resend verification uses `lib/resend-signature.ts`.
- PayPal: `app/api/paypal/webhook/route.ts` returns 503 without `PAYPAL_WEBHOOK_ID` and verifies with PayPal's `verify-webhook-signature` API.
- Remaining: the Brevo query-string secret (see above).

**Cron endpoints:**
- `lib/cron.ts` (`isAuthorizedCron`) requires `Authorization: Bearer $CRON_SECRET` and fails closed when the secret is unset. Good. `cronRoute` is used by all `app/api/cron/*` routes.

**Service-role key used broadly:**
- Risk: `SUPABASE_SERVICE_ROLE_KEY` is read in many server modules, bypassing RLS: `app/[locale]/(site)/tienda/actions.ts`, `revista/actions.ts`, `aviso/actions.ts`, `galeria-3d/actions.ts`, `galeria-3d/wall-actions.ts`, `mi-galeria/actions.ts`, `app/api/gallery/attention/route.ts`, `lib/track-server.ts`, `lib/referral-server.ts`, `lib/receipts.ts`, `lib/artist-social.ts`, `lib/shipment-notices.ts`, `lib/mail/index.ts`, `lib/supabase/admin.ts`.
- Current mitigation: Each action is expected to check the session itself. Layout checks do not protect actions.
- Recommendation: Keep one `createAdminClient()` entry point (`lib/supabase/admin.ts`) and a test per action that rejects an anonymous caller.

**Admin-only HTML injection:**
- Files: `components/admin/template-form.tsx` (line 147), `components/admin/campaign-composer.tsx` (line 275) use `dangerouslySetInnerHTML` for email previews. `components/country-flag.tsx`, `components/flag-ribbon.tsx` inject SVG markup (`lib/flag-svg.ts`).
- Risk: Low for flags (static SVG). For campaign previews, admin-authored templates can include personalized values (names from sign-up forms), so injected content should be escaped or sanitized before preview.
- Fix approach: Escape personalized fields before building the preview HTML; keep flag SVG generated from a fixed table only.

**Redirect validation (correct):**
- `lib/safe-next.ts` validates `next` redirect targets; `lib/safe-next.test.ts` covers it.

**Optional integrations degrade silently:**
- Files: `lib/email-translator.ts` (Anthropic), `lib/resend.ts`, `lib/mercadopago.ts`, `lib/google-sheets.ts`, `lib/payments/paypal`. Missing keys disable features without a startup warning.
- Fix approach: Log one warning at startup for each missing critical key (not a crash).

## Performance Bottlenecks

**Supabase Realtime quota (carried forward, now with kill switches):**
- Files: `components/gallery/presence/GalleryPresence.tsx` (kill switch `NEXT_PUBLIC_GALLERY_LIVE=off`), `components/use-live-home-stats.ts` (kill switch `NEXT_PUBLIC_HOME_LIVE=off`).
- Problem: Gallery presence and home live counters share the Realtime quota. Visitors who leave a tab open hold connections.
- Current mitigation: Pose updates throttled (500 ms), reactions throttled (600 ms), `MAX_LIVE_VISITORS` in `components/gallery/presence/protocol.ts`.
- Fix approach: Keep kill switches ready (`project_realtime_cost_control`). Consider polling for counters.

**Gallery scene (carried forward):**
- Files: `components/gallery/world/Architecture.tsx`, `components/gallery/world/Rooms.tsx`, `components/gallery/world/RemoteVisitors.tsx`
- Problem: One scene with all artworks; geometry merged per material; no LOD. Mobile frame rate not measured.
- Fix approach: Measure with the local perf recipe (`reference_local_perf_measurement`) on a CPU-throttled profile before adding artworks.

**Client image sizing:**
- `next.config.mjs` uses a custom loader (`lib/image-loader.ts`) that routes through `app/api/img`. This replaces the earlier `unoptimized: true` setting. Remaining concern is the sharp cost described under the CPU budget.

## Fragile Areas

**Registro cron sync (multi-step, time-boxed):**
- Files: `app/api/cron/registro/route.ts`, `lib/registro-sync.ts`, `lib/registro.ts`, `lib/reuse-registro-artwork.ts`
- Why fragile: Reads Google Sheets, syncs Supabase, publishes legacy submissions, backs up images. 300 s max, 220 s image budget; a slow Drive or Storage response skips the rest for the run.
- Safe modification: Test with a copy of real sheet rows; keep JSON logs; check the cron report (`?dry=1` supported by `lib/cron.ts`) before changing the schedule.
- Test coverage: `lib/registro.test.ts` and `lib/legacy-submissions.test.ts` cover parts; no end-to-end test of the route.

**Email translation with structured output:**
- Files: `lib/email-translator.ts` (model constant `claude-sonnet-5`, line 11), `lib/email-translation.ts`
- Why fragile: JSON schema output for all locales; one schema problem fails every locale. Model string is hard-coded.
- Safe modification: Test the schema with the model in a scratch script before deploy; keep the model in one constant.
- Test coverage: `lib/email-translation.test.ts` exists; no test for provider failure paths.

**Proxy and anonymous page routing:**
- Files: `proxy.ts`, `lib/static-pages.ts`, `lib/render-mode.ts`, `lib/referral.ts`, `proxy.test.ts`
- Why fragile: Routing depends on cookie presence (`sb-*`), the referral cookie, and `accept-language` / `x-vercel-ip-country`. A new cookie name or a change to `hasSupabaseSession` can send signed-in users to the anonymous copy (or the reverse). `renderAsAnonymous()` is a request-scoped flag via `cache()`; a page that forgets to call it renders personal data into the CDN copy.
- Safe modification: Change `proxy.test.ts` first; check one signed-in and one anonymous request with `curl`.

**Onboarding form state:**
- Files: `app/[locale]/(site)/onboarding/onboarding-form.tsx` (large, many `useState`), `app/[locale]/(site)/onboarding/actions.ts`, `lib/onboarding-image.ts`
- Why fragile: Image uploads race with submit; error paths lightly covered.
- Safe modification: Trace the upload state before editing; test on a slow connection.
- Test coverage: `app/[locale]/(site)/onboarding/actions.ts` has success-path tests; no component tests (vitest runs in node only).

**Admin obras actions:**
- Files: `app/[locale]/(site)/admin/obras/actions.ts`, `components/admin/legacy-image-sync.tsx`
- Why fragile: Publishes, hides and re-fetches Drive images in one module. Failure in one image leaves the record half-updated.
- Test coverage: `app/[locale]/(site)/admin/obras/actions.test.ts` exists; coverage of the Drive image path not verified.

## Scaling Limits

**Cron and CPU are the binding limit, not user count:**
- Current capacity: Budget of 4 h Active CPU per 30 days for the team (Hobby). The Vercel dashboard is the only reliable measure; this map did not measure it.
- Limit: A few heavy cron runs, or a cache-busting deploy, can exhaust the window. The project is then paused until reset.
- Scaling path: Upgrade to Pro, or cut the per-request and per-cron work listed above.

**Realtime visitors on one channel:**
- Current capacity: `MAX_LIVE_VISITORS` (see `components/gallery/presence/protocol.ts`).
- Limit: Realtime message volume and connection count.
- Scaling path: Multiple channels per room, or polling.

**Email campaigns:**
- Current capacity: Batch size in `lib/resend.ts` and `lib/campaign-delivery.ts`.
- Limit: Resend rate limits; campaign sends run inside cron or admin actions and share the CPU budget.
- Scaling path: Queue sends with backoff; run them outside the CPU-metered path if possible.

## Dependencies at Risk

**sharp (native binary):**
- Used by `app/api/img/route.ts` and every image renderer listed in `lib/cost-guards.test.ts`. Native build issues on Vercel show up at deploy.
- Mitigation: Version pinned by `^0.35.4` in `package.json`; check after each Next upgrade.

**Next.js 16 and the proxy file:**
- `package.json` pins `next` 16.3.5. Routing (`proxy.ts`) and `next/root-params` are used by `lib/i18n/server.ts`. Upgrades can change proxy semantics; the matcher test (`proxy.test.ts`) is the guard.

**Anthropic model string:**
- `lib/email-translator.ts` uses `claude-sonnet-5`. If the model is retired, translation fails for every locale; the feature degrades to Spanish-only.

**Resend, Brevo, Mercado Pago, PayPal:**
- External dependencies for email, webhooks and payments. Outages block purchases and sends. Payment status can be checked from the admin panel; no automatic reconciliation was found.

## Missing Critical Features

**Pre-launch items (from ROADMAP.md, not re-verified in code):**
- Logo: `components/site-header.tsx` still uses the generated badge (per prior map; not re-checked).
- Google OAuth verification: unverified app warning on sign-in.
- Data cleanup of legacy submissions before public launch.

**Previously missing features now present (verified by file):**
- Error page: `app/[locale]/(site)/error.tsx` and `not-found.tsx` exist (no root-level boundary, see Known Bugs).
- Artist profile page: `app/[locale]/(site)/artistas/[slug]/page.tsx` exists.
- Store and subscriptions: `app/[locale]/(site)/tienda/`, `app/api/paypal/subscriptions/route.ts`, `lib/mp-subscriptions.ts` exist; checkout completeness not verified.
- PayPal: routes under `app/api/paypal/*` exist; webhook verification is implemented.

## Test Coverage Gaps

**API route handlers vs tests:**
- 25 route handlers under `app/` (`find app -name route.ts`), 6 test files under `app/api` plus `app/[locale]` route tests.
- Not covered by tests: `app/api/cron/registro/route.ts` (sync logic), `app/api/cron/exhibition/route.ts`, `app/api/cron/campanas/route.ts` (sending), `app/api/track/route.ts`, `app/api/paypal/orders/*`, `app/api/paypal/return/route.ts`.
- Priority: High. These touch money, email and customer data.

**Client components:**
- Vitest runs in the Node environment only (`vitest.config.mts`). No component tests for `components/` or `app/` client forms.
- Priority: Medium.

**Anonymous copies:**
- `lib/static-pages.test.ts` checks that copies exist. No test checks that a copy reads no cookies, headers or `searchParams`.
- Priority: High for CPU budget; add a static check (grep for `cookies|headers|searchParams` in each anon file's import graph) or a `next build` assertion that anon routes show `●`.

**Cost guards:**
- `lib/cost-guards.test.ts` enforces the image renderer allowlist and the no-store fetch check. Good. It does not check `force-dynamic`, `no-store` route responses, or `s-maxage` on public GET routes; extend it with the same allowlist pattern.

**Server actions:**
- `app/[locale]/(site)/admin/obras/actions.test.ts` exists but covers only part of the module (`actions.ts` is large). `app/[locale]/(site)/admin/campanas/actions.ts` has no test file.
- Priority: High (admin write paths).

---

*Concerns audit: 2026-11-08*
