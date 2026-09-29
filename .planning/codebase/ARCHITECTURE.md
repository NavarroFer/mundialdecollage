<!-- refreshed: 2026-09-29 -->
# Architecture

**Analysis Date:** 2026-09-29

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Public & Artist-Facing Pages                        │
│  Home Page, Onboarding, Artworks, 3D Gallery, AR Viewer, Participantes     │
│  `app/page.tsx`, `app/onboarding/`, `app/galeria-3d/`, `app/ar/[slug]/`   │
└──────────────────┬──────────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────────────┐
│                         Admin Panel (Moderators)                            │
│  Artworks, Campaigns, Templates, Stats, Payments, Contacts, Comments       │
│  `app/admin/` - Auth-protected via ADMIN_EMAILS and Supabase session       │
└──────────────────┬──────────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────────────┐
│                         Business Logic Layer                                │
│  `lib/` - Server-side functions, queries, translations, transformations    │
│  • Supabase queries (finalists, artworks, profiles, payments)              │
│  • Email composition & translation                                          │
│  • I18n & formatting                                                        │
│  • AR/3D helpers & state management                                         │
│  • Authentication & authorization                                           │
└──────────────────┬──────────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────────────┐
│                         API Routes                                          │
│  `app/api/` - Webhook handlers, data endpoints, cron jobs                  │
│  • GET /api/obras - Published artworks search index (cached 5m)            │
│  • POST /api/track - Analytics event tracking                              │
│  • POST /api/mercadopago/webhook - Payment notifications                   │
│  • POST /api/resend/webhook - Email delivery/bounce tracking               │
│  • GET /api/cron/* - Scheduled jobs (exhibition, registro sync)            │
└──────────────────┬──────────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────────────────────┐
│                         Database & External Services                        │
│  Supabase (Auth, Postgres DB, Storage), MercadoPago, Resend, Clarity      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Public Site | Render homepage sections, festival info, artist profiles | `app/page.tsx`, `components/*-section.tsx` |
| Onboarding Flow | Artist signup, profile completion, artwork submission | `app/onboarding/`, `components/onboarding-*` |
| Admin Panel | Curate artworks, manage campaigns, view analytics | `app/admin/`, `components/admin/*` |
| 3D Gallery | Interactive Three.js gallery with multiplayer presence | `app/galeria-3d/page.tsx`, `components/gallery/` |
| AR Viewer | Mobile AR experience for printed cards | `app/ar/[slug]/page.tsx`, `components/ar/` |
| Individual Artwork Pages | Public page for submitted artworks | `app/obras/[slug]/page.tsx` |
| Workshop/Taller | Workshop registration and confirmation | `app/taller/` |
| Supabase Client Layer | Database access, authentication | `lib/supabase/` |
| Business Logic | Queries, email, formatting, transformations | `lib/*.ts` |

## Pattern Overview

**Overall:** Next.js Server Components with React 19, Supabase RLS, event-driven email workflows.

**Key Characteristics:**
- **Server-first rendering**: Pages use `async` components and fetch data server-side via `createClient()` or `createPublicClient()`
- **Row-Level Security**: Supabase RLS policies filter data by user role (admin, artist, public)
- **Client state**: Zustand stores for 3D gallery interaction state (player position, UI state, presence)
- **Cached queries**: React's `cache()` wraps Supabase queries to avoid duplicate requests in a single render pass
- **Email-driven**: User actions trigger email templates, often via Resend or internal API routes

## Layers

**Presentation Layer:**
- Purpose: Render UI for public users, artists, and admins
- Location: `components/`, `app/`
- Contains: React components (.tsx), page layouts, interactive elements
- Depends on: `lib/` (data fetching), i18n, Supabase client
- Used by: Next.js routing system, React rendering engine

**Business Logic Layer:**
- Purpose: Query data, transform, compute, format, coordinate workflows
- Location: `lib/`
- Contains: Supabase queries, email templates, i18n, calculations (e.g., galleries, payments)
- Depends on: Supabase client (`lib/supabase/`), external APIs (MercadoPago, Resend, Anthropic)
- Used by: Pages, components, API routes, cron jobs

**Database & Data Access Layer:**
- Purpose: Store and retrieve artist profiles, artworks, submissions, payments, email logs
- Location: Supabase (Postgres + Auth + Storage), `lib/supabase/`
- Contains: Tables (profiles, artworks, payments, etc.), RLS policies, functions, migrations
- Depends on: Supabase platform
- Used by: All authenticated pages, admin panel, API routes

**API & External Integration Layer:**
- Purpose: Handle webhooks, expose data endpoints, coordinate background jobs
- Location: `app/api/`
- Contains: Route handlers (POST/GET), webhook processors
- Depends on: Business logic (`lib/`), external services
- Used by: MercadoPago, Resend, cron triggers, frontend data requests

**Infrastructure & Utilities:**
- Purpose: Support translations, formatting, shared types, authentication
- Location: `lib/i18n/`, `lib/supabase/`, utilities
- Contains: Locale data, message catalogs, client factories, helpers
- Depends on: Next.js, Supabase SDK
- Used by: All layers

## Data Flow

### Primary Request Path: Home Page Render

1. **Entry point** — `app/page.tsx` (Server Component)
   - Receives `searchParams` (e.g., `?ref=...` for referral tracking)
   - Calls `getI18n()` to pick user's language
   - Renders multiple section components in sequence

2. **Section rendering** (e.g., `ParticipantsSection`, `MapSection`, `FlagRibbon`)
   - Each section calls `getFinalists()` from `lib/finalists.ts`
   - `getFinalists()` is wrapped in `cache()`, so multiple sections share one query
   - Query calls `createPublicClient()` → Supabase RLS filters to published artworks only
   - Components format data (translate country codes to flags, names, etc.) from `lib/participants.ts`, `lib/country-codes.ts`

3. **Output & response** (`app/layout.tsx`)
   - Root layout wraps children in `I18nProvider` and analytics components
   - HTML sent to browser with metadata (OG tags, title)
   - Analytics (Clarity, Vercel) scripts injected for tracking

### Artist Onboarding Path

1. **Sign-in page** — `app/onboarding/page.tsx`
   - If no session cookie, show "Sign in with Google" button
   - On sign-in success, redirects to callback, which sets session in cookie

2. **Onboarding form** — `app/onboarding/page.tsx` (after login)
   - `OnboardingForm` component renders form for artist details (name, country, bio, etc.)
   - On submit, calls Server Action `completeOnboarding()` from `app/onboarding/actions.ts`
   - Action inserts/updates `profiles` table, creates `artworks` row, sends confirmation email via Resend

3. **Artwork submission** — `app/onboarding/obras/page.tsx`
   - Artist uploads image (stored in Supabase Storage, public bucket)
   - Form captures title, technique, details
   - Server Action updates artwork record
   - May send "artwork received" email

4. **Confirmation page** — `app/onboarding/confirmado/page.tsx`
   - Displays summary of submitted work
   - Shows profile link if published

### Admin Curation Path

1. **Admin guard** — `app/admin/layout.tsx`
   - Checks session user's email against `ADMIN_EMAILS` from `lib/admin.ts`
   - Redirects to `/` if not authorized

2. **Artworks gallery** — `app/admin/obras/page.tsx`
   - Fetches all `artworks` (including unpublished) from Supabase via Server Component
   - Groups by `profile_id`
   - Shows thumbnails, artist name, country
   - Admin can:
     - `selectArtwork()` — Set `is_selected=true` to mark for publication
     - `deleteArtwork()` — Archive the work
     - `importLegacySubmissions()` — Bulk import from legacy system

3. **Campaign composer** — `app/admin/campanas/page.tsx`
   - Admin creates email templates via `campaign-composer.tsx`
   - Saves to `email_templates` table
   - Can preview and send to filtered audience

### 3D Gallery State Management

1. **Page load** — `app/galeria-3d/page.tsx`
   - Fetches daily selection of 20 artworks via `getGalleryArtworks(locale)`
   - Passes artwork list to `Game` component

2. **Game render** — `components/gallery/Game.tsx`
   - Initializes Three.js scene with Rapier physics
   - Creates Zustand stores for UI state:
     - `usePlayerTrackerStore` — Player position/heading on minimap
     - `useTouchStore` — Mobile touch input state
     - `useInteractionStore` — Which UI panel is open (details, info, etc.)
     - `usePresenceStore` — Other players' positions (Supabase Realtime)
   - Renders React Three Fiber scene + UI overlay

3. **Realtime updates** — Supabase Realtime subscription
   - Gallery publishes player position updates to channel
   - Other connected visitors see avatars move on minimap

### 3D Gallery to Artwork Detail

1. Click artwork in gallery → Opens panel with `ObraViewer` component
2. Panel shows image, title, artist name, country flag, share button
3. "View on site" link → navigates to `app/obras/[slug]/page.tsx`

### AR Experience Path

1. **Print card QR** → Points to `app/ar/[slug]?modo=tarjeta`
   - `getFinalistBySlug()` fetches artwork (if published or artist-owned)
   - `ArViewer` component initializes MindAR with print target
   - Overlay shows artwork info in artist's language (via `?idioma=` param)

2. **AR on artwork** → Points to `app/ar/[slug]?modo=obra`
   - Same component but targets the artwork image itself
   - When camera recognizes image, displays 3D model or AR effect

**State Management:**
- **Server state**: Supabase tables (source of truth)
- **Client ephemeral state**: Zustand stores for UI interaction, position
- **Server-side cache**: React `cache()` for per-request dedup
- **Client-side cache**: Next.js router cache for page navigation

## Key Abstractions

**Finalist:**
- Purpose: A published, curated artwork by an artist
- Examples: `lib/finalists.ts` (type), `lib/gallery-artworks.ts` (daily selection)
- Pattern: Fetched via Supabase RLS policy "artworks: public read of published profiles" — only available if `is_selected=true` AND profile `is_public=true`

**Profile (Artist):**
- Purpose: Represents an artist account
- Examples: `lib/participants.ts`, `app/onboarding/`
- Pattern: Owns many artworks, stored in `profiles` table with auth links

**Artwork:**
- Purpose: A single submitted piece
- Examples: `lib/finalists.ts`, `app/admin/obras/page.tsx`
- Pattern: Multiple per profile now supported (migration 20260921), admin curates via `is_selected` flag

**Admin Section:**
- Purpose: Organize admin panel navigation
- Examples: `components/admin/admin-sections.ts`, `components/admin/admin-nav.tsx`
- Pattern: Object with section name, icon, description, and links to pages

**Email Campaign:**
- Purpose: Template-based emails sent to filtered audience
- Examples: `lib/email-blocks.ts`, `components/admin/campaign-composer.tsx`
- Pattern: Built from reusable blocks (text, image, button), stored in DB, sent via Resend

**Gallery Artwork (Daily Selection):**
- Purpose: 20-artwork daily subset for 3D gallery
- Examples: `lib/gallery-artworks.ts`
- Pattern: Computed daily, stored in session/state, doesn't change mid-session

## Entry Points

**Home Page:**
- Location: `app/page.tsx`
- Triggers: User visits domain root `/`
- Responsibilities: Render hero, sections (participants, jury, workshop, etc.), footer with referral tracking

**Onboarding:**
- Location: `app/onboarding/page.tsx`
- Triggers: Artist clicks "Enviá tu obra" or direct link
- Responsibilities: Sign-in flow, form collection, submission tracking

**Admin:**
- Location: `app/admin/layout.tsx` → redirects to `app/admin/obras/page.tsx`
- Triggers: Logged-in admin visits `/admin`
- Responsibilities: Auth guard, render admin shell, load artwork gallery

**API Webhooks:**
- Location: `app/api/mercadopago/webhook`, `app/api/resend/webhook`
- Triggers: Payment confirmation or email bounce from external service
- Responsibilities: Update payment status, log email events

**Cron Jobs:**
- Location: `app/api/cron/exhibition/route.ts`, `app/api/cron/registro/route.ts`
- Triggers: Vercel scheduled tasks (timing from cron config in production)
- Responsibilities: Sync data, send notifications, maintain consistency

## Architectural Constraints

- **Threading:** Single-threaded event loop (Node.js). Supabase Realtime uses WebSocket for real-time gallery presence.
- **Global state:** Few singletons — mostly Zustand stores per component tree. Supabase client is stateless (cookie-managed sessions).
- **Circular imports:** Rare; organized by layer (lib → components → pages)
- **RLS policies:** All database queries filtered by role at row level; app code does not duplicate auth checks
- **Next.js 16**: Uses latest features (Server Components by default, dynamic routing with layouts)
- **Storage:** Image uploads go to Supabase Storage public bucket; served via `<Image>` with `unoptimized={true}` (Vercel optimization disabled to avoid 402 errors)

## Anti-Patterns

### Hardcoded Artwork Count or Static Data

**What happens:** Old code hardcodes "25 finalists" or snapshot of artworks in a Constant.

**Why it's wrong:** When new artworks are added, counts are stale. Front-end shows outdated numbers, confusing users. Breaks if artists withdraw.

**Do this instead:** Query `lib/finalists.ts` functions which fetch live data from Supabase. Every page render gets current state. Example: `components/participation-status.tsx` queries live counts.

### Duplicating RLS Logic in Application Code

**What happens:** Page checks `user.email in ADMIN_EMAILS` before fetching, then Supabase RLS also filters.

**Why it's wrong:** Maintenance burden, security risk if app-side check is missed. RLS becomes unreliable as fallback.

**Do this instead:** Trust RLS. App checks ADMIN_EMAILS only for UI routing (which page to show). Data queries rely solely on Supabase RLS policies. See `app/admin/layout.tsx` (auth guard) vs. `app/admin/obras/page.tsx` (query trusts RLS).

### Client-side State as Source of Truth

**What happens:** Zustand store holds artwork list; clicking a button mutates store; no server call.

**Why it's wrong:** If another admin deletes artwork while gallery is open, store becomes stale. Two admins see different states.

**Do this instead:** Zustand stores hold ephemeral UI state only (minimap position, which panel is open). Artwork data comes from Supabase cache or refetch. See `components/gallery/minimap/store.ts` (position only, not data).

## Error Handling

**Strategy:** Graceful degradation with user-facing messages.

**Patterns:**
- **Auth errors**: Redirect to sign-in, preserve intended destination
- **Missing data**: Show "not found" page (e.g., artwork doesn't exist or not published)
- **API failures**: Log error, show "something went wrong, try again" message; don't expose stack traces to client
- **Supabase outage**: If `isSupabaseConfigured()` is false, return empty data (e.g., `[]` for artworks) rather than crashing
- **Image load failures**: Fallback to placeholder or artist name if image URL 404s

## Cross-Cutting Concerns

**Logging:** Server-side via `console.log()` (appears in Vercel logs). Client analytics via Clarity and Vercel Analytics. Email delivery tracked via `app/api/resend/webhook`.

**Validation:** Form inputs validated on client (React) and server (Server Actions) before persisting to DB. Supabase column constraints as final guard.

**Authentication:** Supabase Auth with Google provider. Session cookie managed by middleware in `@supabase/ssr`. Admin role check via email whitelist (`ADMIN_EMAILS`).

**Internationalization:** `lib/i18n/` provides `getI18n()` (server) and `I18nProvider` (client) to detect and inject user's locale. Message keys stored in `lib/i18n/messages/` per language. Format functions in `lib/i18n/format.ts` (dates, names, etc.).

---

*Architecture analysis: 2026-09-29*
