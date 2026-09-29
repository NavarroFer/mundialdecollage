# Codebase Concerns

**Analysis Date:** 2026-09-29

## Tech Debt

**Large Component Files (Consolidation Candidates):**
- Issue: Multiple components exceed 500+ lines and combine multiple responsibilities
- Files: 
  - `components/depth-carousel.tsx` (507 lines) - Complex animation/UI logic with GSAP state management
  - `components/admin/email-block-editor.tsx` (572 lines) - Form composition + rich text editing
  - `app/onboarding/onboarding-form.tsx` (498 lines) - Multi-step form with image upload, validation, and async state
  - `app/admin/obras/page.tsx` (498 lines) - Gallery rendering + filtering + admin actions
- Impact: Difficult to test, harder to maintain, potential performance issues in render cycles
- Fix approach: Extract composed sub-components (form sections, modal dialogs, toolbar sections), move validation/business logic to separate utilities

**Server Action Complexity:**
- Issue: Large server actions combining multiple database operations and external API calls
- Files:
  - `app/admin/obras/actions.ts` (648 lines) - Mixing profile visibility, legacy submission publishing, image fetching, and more
  - `app/admin/campanas/actions.ts` (455 lines) - Email translation, template management, batch sending in one file
- Impact: Difficult to test individually, harder to reason about failure modes
- Fix approach: Separate concerns into focused functions (one per cohesive operation); create test suites for retry/error scenarios

**Message/Translation Files Hardcoded as TypeScript:**
- Issue: `lib/i18n/messages/*.ts` (9 files × ~470 lines each) store all i18n strings as TypeScript objects
- Files: `lib/i18n/messages/{en,es,pt,it,fr,de,ru,pl,id}.ts`
- Impact: Large bundle contribution; no lazy loading; any translation change requires code change + deploy
- Fix approach: Consider migrating to JSON format with dynamic loading per locale; implement incremental translation updates via admin UI

## Known Bugs

**Missing Error Boundary for App Routes:**
- Symptoms: No `error.tsx` file in `/app/` tree; unhandled route errors may not display user-friendly error page
- Files: App root directory (missing `app/error.tsx`)
- Trigger: Any unhandled exception in a Server Component during render
- Workaround: Global error boundary not in place; users see raw error or blank page
- Fix: Create `app/error.tsx` as a Client Component with fallback UI

**Admin Page Authentication Checked in Layout Only:**
- Symptoms: Admin routes are protected by layout-level auth check, but Server Actions in those routes also re-check via `assertIsAdmin()`
- Files: `app/admin/layout.tsx` (line 18), `app/admin/obras/actions.ts` (line 23-30)
- Trigger: If someone finds a direct Server Action endpoint URL, the action's own `assertIsAdmin()` catches it — but only after the layout check succeeds
- Workaround: Double auth check is actually correct (actions are callable directly), but easy to forget on new actions
- Fix: Create a `createAdminAction()` wrapper that enforces auth automatically, or add an ESLint rule

**Webhook Signature Verification Optional:**
- Symptoms: If `MERCADOPAGO_WEBHOOK_SECRET` or `RESEND_WEBHOOK_SECRET` are missing, signature verification is skipped with a console.warn
- Files:
  - `app/api/mercadopago/webhook/route.ts` (line 55-59)
  - `app/api/resend/webhook/route.ts` (line 20-24)
- Trigger: In development or if secrets aren't set in production
- Impact: Webhooks can be spoofed in those environments
- Fix: Throw an error in production if secrets are missing; only allow skipping in development/preview

## Security Considerations

**Supabase Service Role Key Exposure Risk:**
- Risk: Service-role key checked via `process.env.SUPABASE_SERVICE_ROLE_KEY` in multiple client-callable Server Actions
- Files: `app/admin/obras/actions.ts` (comment line 17-21), `app/galeria-3d/actions.ts` (line 27)
- Current mitigation: `assertIsAdmin()` and layout-level auth check; actions not exposed in public URLs
- Recommendations: 
  - Document that any new Server Action using admin client needs explicit auth check
  - Consider creating a wrapper function for "admin-only actions" to prevent accidental exposure

**Redirect Validation Implemented Correctly:**
- Status: `lib/safe-next.ts` properly validates redirect targets to prevent open redirect attacks
- No concerns here

**API Key Configuration Optional:**
- Risk: Multiple integrations (Anthropic, Resend, MercadoPago, Google Sheets) can operate partially without API keys
- Files: `lib/email-translator.ts`, `lib/resend.ts`, `lib/mercadopago.ts`, `lib/google-sheets.ts`
- Current mitigation: Features gracefully degrade (emails Spanish-only without translator, no image sync without Google Sheets key)
- Note: This is intentional design for staged rollout; not a security issue

## Performance Bottlenecks

**Supabase Realtime Cost Concern:**
- Problem: 3D gallery presence system uses Supabase Realtime for position tracking, reactions, and live visitor counters
- Files: `components/gallery/presence/GalleryPresence.tsx` (Realtime connection + broadcasts)
- Current behavior:
  - One public channel per environment (`galeria-3d` prod, `galeria-3d-dev` dev)
  - Pose updates throttled to 500ms; reactions throttled to 600ms
  - Capped at `MAX_LIVE_VISITORS` (5-10 active broadcasters)
- Concern: Realtime pricing is per-connection; high traffic → high cost; user behavior (leaving page open) → persistent connections
- Scaling path:
  - Monitor Realtime message volume and active connections
  - Consider moving to polling-based approach for large visitor counts (1000+)
  - Set up Supabase cost alerts; cap visible visitor count early

**No Image Optimization on Client:**
- Problem: Images served directly from Supabase Storage without optimization; `next/image` has `unoptimized: true`
- File: `next.config.mjs` (line 9)
- Cause: Vercel image optimization had 402 errors; chose to optimize on upload instead
- Impact: Higher bandwidth usage for visitors; large artwork photos sent at full resolution
- Improvement path:
  - Ensure upload pipeline resizes to max 2000px (check `lib/onboarding-image.ts`)
  - Add next/image with `priority` hints for above-fold artwork cards
  - Consider WebP conversion on upload (if Supabase Storage supports)

**Gallery World Rendering (Three.js):**
- Problem: Large 3D scene with merged geometry; all artworks in one scene
- Files: `components/gallery/world/Architecture.tsx`, `components/gallery/world/Rooms.tsx` (340 lines)
- Current optimization: Geometry merged per material to reduce draw calls
- Concern: As artwork count grows (hundreds), scene graph complexity grows; mobile devices may struggle
- Improvement path:
  - Monitor frame rate on low-end devices
  - Implement Level-of-Detail (LOD) for artwork cards at distance
  - Consider splitting scene into room-based chunks with occlusion culling

## Fragile Areas

**Email Translation with Anthropic (Structured Output):**
- Files: `lib/email-translator.ts`
- Why fragile: Uses `output_config.format: { type: 'json_schema' }` with strict schema validation; if schema is wrong, translations fail
- Failure mode: One bad schema property → all 8 languages fail; no partial recovery
- Safe modification: Test schema changes with `claude-sonnet-5` before pushing to production; add schema validation tests
- Test coverage: No tests for translation failures or schema mismatches
- Fix: Add test suite for each locale's translation output; mock Anthropic responses

**Admin Gallery Image Sync (Drive + Storage):**
- Files: `app/admin/obras/actions.ts` (legacy image fetching), `components/admin/legacy-image-sync.tsx`
- Why fragile: Fetches from Google Drive, transforms images (resizes, optimizes), uploads to Supabase Storage in a 5-minute window
- Failure mode: If image fetch fails midway, retry deferred to next cron run; if upload fails, backup saved but image missing
- Safe modification: Always wrap Drive API calls in try-catch; test with real image file sizes
- Test coverage: No E2E tests for full sync pipeline; only unit test for "oversized photo shrinking"
- Fix: Add integration test for Drive fetch + Supabase upload; mock Drive API responses

**Registro Cron Sync (Complex Multi-Step Operation):**
- Files: `app/api/cron/registro/route.ts`, `lib/registro-sync.ts`
- Why fragile: Reads from Google Sheets, syncs to Supabase, publishes legacy submissions, handles image backups
- Timeout: 300 seconds max duration; image budget is 220 seconds → if image downloads are slow, operations get skipped
- Safe modification: Always add detailed logging (JSON format); test with real sheet data before deploy
- Test coverage: Only `scripts/apps-script-registro.test.mts` tests the Apps Script validation, not the Supabase sync
- Fix: Add test for sync with various sheet formats; mock Supabase responses

**Onboarding Form State Management:**
- Files: `app/onboarding/onboarding-form.tsx` (498 lines, heavy React state)
- Why fragile: Multiple `useState` for image slots, form state, submission state; complex async flows
- Failure mode: Race condition if user submits while image is uploading; error states not fully covered
- Safe modification: Trace through image upload flow before changing; test on slow connections
- Test coverage: No client-component tests (vitest only covers lib/); heavy reliance on E2E testing
- Fix: Extract form logic to custom hooks; add unit tests for validation functions

## Scaling Limits

**Realtime Visitors on One Channel:**
- Current capacity: `MAX_LIVE_VISITORS` hardcoded (appears to be ~10)
- Limit: Supabase Realtime pricing and message throughput; each visitor position update = one broadcast
- Scaling path: At 1000+ concurrent visitors, split into multiple channels per room; or switch to polling

**Admin Panel Concurrent Users:**
- Current capacity: Not tested; Supabase RLS should handle concurrent reads/writes
- Limit: No rate limiting on admin actions (e.g., bulk re-publish artworks)
- Scaling path: Add optimistic locking for admin operations; consider request deduplication

**Email Campaign Sending:**
- Current capacity: `RESEND_BATCH_SIZE` (check `lib/resend.ts` for value)
- Limit: Resend API rate limits and concurrency
- Scaling path: Implement queue-based sending with exponential backoff; monitor Resend usage

## Dependencies at Risk

**Anthropic SDK for Email Translation:**
- Risk: Model `claude-sonnet-5` may be deprecated or pricing may change
- Impact: Email template translations fail; feature disables gracefully (Spanish-only fallback)
- Migration plan: Version lock SDK; if model changes, fall back to `claude-haiku` or remove translation feature

**Sharp (Image Processing):**
- Risk: Native binary dependency; may have vulnerabilities or build issues
- Current usage: Image resizing on upload (see `lib/onboarding-image.ts`)
- Alternative: Use Vercel's `next/image` with external service, or AWS Lambda for processing

**Resend (Email Service):**
- Risk: External service dependency; rate limits, service outages affect admin campaigns
- Impact: Admins can't send email campaigns if Resend is down
- Mitigation: Queue emails in database if Resend fails; implement retry logic
- Current status: No queue implemented; failures logged but not retried

**MercadoPago Payment Gateway:**
- Risk: Payment processing dependency; outages block purchases
- Impact: Workshop registration and multi-entry payments blocked
- Mitigation: None currently; payment status must be manually checked in admin panel

## Missing Critical Features

**PayPal Integration (Incomplete):**
- Problem: PayPal button shows "Próximamente" but no implementation
- Files: Referenced in `ROADMAP.md` (item 4b) and `lib/site.ts` (TODO comment)
- Blocks: Artists in non-Mercado Pago regions can't pay for extra entries
- Impact: Revenue loss; artist experience incomplete

**Error Boundary (Missing):**
- Problem: No `app/error.tsx` for centralized error handling
- Blocks: Graceful error display in production
- Impact: Users see raw errors or blank pages on unhandled exceptions

**Artist Profile Page (Missing):**
- Problem: No `/artista/[id]` or similar route
- Files: Mentioned in `ROADMAP.md` (item 8)
- Blocks: Artists can't download their own AR card PDFs without admin access
- Impact: User experience friction

**Subscription / Monthly Shop (Incomplete):**
- Problem: Infrastructure missing for recurring payments or shopping cart
- Files: `ROADMAP.md` (items 4, 7) outline plans but no code
- Blocks: Revenue model for monthly products

## Test Coverage Gaps

**API Routes Untested:**
- What's not tested: Webhook handlers, cron routes, public API endpoints
- Files:
  - `app/api/mercadopago/webhook/route.ts` - No tests for signature verification or payment processing
  - `app/api/resend/webhook/route.ts` - No tests for email bounce/complaint handling
  - `app/api/cron/registro/route.ts` - No tests for sync logic or backup creation
  - `app/api/cron/exhibition/route.ts` - No tests for email sending
- Risk: Undetected failures in payment/email flows; hard to debug in production
- Priority: High - these routes touch customer data and revenue

**Client Components Not Unit Tested:**
- What's not tested: React components in `/components`, form validation, UI logic
- Files: Most `.tsx` files in `components/` and `app/` pages
- Cause: Vitest configured for Node environment only; no React testing library setup
- Impact: UI bugs only caught by manual testing or user reports
- Priority: Medium - could use integration/E2E tests instead

**Server Action Error Paths:**
- What's not tested: Redirect flows, error messages, auth failures
- Files:
  - `app/onboarding/actions.ts` - Has tests for success path, not error cases
  - `app/admin/obras/actions.ts` - 648 lines, no tests
  - `app/admin/campanas/actions.ts` - 455 lines, no tests
- Risk: Error messages leaked to users; silent failures in admin actions
- Priority: High - admin actions are critical paths

**Integration Tests Missing:**
- What's not tested: End-to-end flows (onboarding → submission → admin review → publish)
- Impact: Regressions only caught in production or manual QA
- Priority: Medium - consider adding with Playwright or similar

## Pre-Launch Concerns

**Data Cleanup Needed:**
- Files: Legacy submissions in `legacy_submissions` table and any manually imported data
- Concern: Names, countries, and other fields may have inconsistent formatting (uppercase, mixed case, typos)
- Roadmap reference: `ROADMAP.md` (item 5)
- Fix: Run sanitization script before public launch; review in `/admin/obras`

**Logo Not Finalized:**
- Concern: `components/site-header.tsx` generates a badge "M" instead of final logo
- Impact: Non-professional appearance; branding incomplete
- Timeline: Must complete before public launch

**Google Auth Not Verified:**
- Concern: OAuth app not verified with Google; users see "unverified app" warning
- Impact: Trust issue for sign-up flow
- Timeline: Must complete before public launch
- Roadmap reference: `ROADMAP.md` (item 5)

**Incomplete Environment Configuration:**
- Concern: Multiple `.env` variables are optional; some features degrade silently
- Impact: Admin may not realize features are disabled (no error message at startup)
- Fix: Log warnings at startup if critical integrations are missing

---

*Concerns audit: 2026-09-29*
