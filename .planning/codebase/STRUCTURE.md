# Codebase Structure

**Analysis Date:** 2026-09-29

## Directory Layout

```
mundialdecollage/
├── app/                          # Next.js App Router pages and layouts
│   ├── admin/                    # Moderator panel (auth-protected)
│   │   ├── layout.tsx            # Admin shell, auth guard
│   │   ├── page.tsx              # Redirects to /admin/obras
│   │   ├── campanas/             # Email campaigns
│   │   ├── comentarios/          # Comments/feedback admin
│   │   ├── contactos/            # Contact form submissions
│   │   ├── estadisticas/         # Analytics dashboard
│   │   ├── inscripciones/        # Workshop registrations
│   │   ├── obras/                # Artwork curation gallery
│   │   ├── pagos/                # Payment logs
│   │   └── plantillas/           # Email template manager
│   ├── api/                      # Route handlers
│   │   ├── cron/                 # Scheduled jobs
│   │   ├── mercadopago/webhook/  # Payment notifications
│   │   ├── resend/webhook/       # Email delivery tracking
│   │   ├── obras/                # GET /api/obras - search index
│   │   ├── track/                # POST /api/track - analytics
│   │   └── unsubscribe/          # Email unsubscribe link
│   ├── ar/[slug]/                # AR viewer for prints/artworks
│   ├── auth/callback/            # OAuth callback handler
│   ├── edicion-2026/             # Special edition page
│   ├── galeria-3d/               # Interactive 3D gallery
│   ├── onboarding/               # Artist signup flow
│   │   ├── page.tsx              # Sign-in or form
│   │   ├── obras/                # Artwork upload/edit
│   │   └── confirmado/           # Success confirmation
│   ├── obras/[slug]/             # Individual artwork pages
│   ├── participantes/            # Participants map/list
│   ├── taller/                   # Workshop registration
│   ├── politica-de-privacidad/   # Privacy policy
│   ├── terminos-y-condiciones/   # Terms & conditions
│   ├── monitoring/               # Health check endpoints
│   ├── layout.tsx                # Root layout (fonts, providers)
│   ├── page.tsx                  # Homepage
│   ├── globals.css               # Global styles (Tailwind)
│   ├── robots.ts                 # Robots.txt
│   └── sitemap.ts                # Sitemap.xml
├── components/                   # React components (organized by feature)
│   ├── admin/                    # Admin-only UI components
│   │   ├── admin-nav.tsx         # Admin sidebar/nav
│   │   ├── admin-sections.ts     # Admin menu structure
│   │   ├── page-header.tsx       # Page title + stats
│   │   ├── campaign-composer.tsx # Email builder UI
│   │   ├── submissions-gallery.tsx # Artwork grid
│   │   ├── artwork-edit-form.tsx # Artwork details form
│   │   ├── email-block-editor.tsx # Email block drag-drop
│   │   ├── obra-viewer.tsx       # Artwork detail modal
│   │   ├── template-form.tsx     # Email template editor
│   │   ├── translation-badge.tsx # Translation status indicator
│   │   ├── stat-bar.tsx          # Stats bar for pages
│   │   └── submission-types.ts   # Type definitions
│   ├── ar/                       # AR viewer components
│   │   └── ar-viewer.tsx         # MindAR integration
│   ├── auth/                     # Auth-related components
│   ├── gallery/                  # 3D gallery (Three.js/Rapier)
│   │   ├── Game.tsx              # Main game loop
│   │   ├── artwork/              # Artwork card in gallery
│   │   ├── camera/               # Camera control
│   │   ├── interaction/          # Mouse/touch input + Zustand store
│   │   ├── minimap/              # Minimap + player position store
│   │   ├── mobile/               # Mobile touch controls
│   │   ├── player/               # Player avatar/mesh
│   │   ├── presence/             # Multiplayer presence (Realtime)
│   │   ├── tutorial/             # Tutorial UI
│   │   ├── world/                # World mesh/lighting
│   │   ├── ui/                   # Gallery UI panels
│   │   ├── themes.ts             # Color themes
│   │   └── gallery-theme.module.css # Scoped gallery styles
│   ├── ui/                       # Reusable UI primitives (buttons, dialogs, etc.)
│   ├── about-section.tsx         # Homepage: About Festival
│   ├── bases-banner.tsx          # Homepage: Rules callout
│   ├── countdown.tsx             # Countdown timer
│   ├── depth-carousel.tsx        # Carousel with parallax
│   ├── edition-section.tsx       # Homepage: Edition info
│   ├── fade-in.tsx               # Fade-in animation wrapper
│   ├── flag-ribbon.tsx           # Homepage: Flag banner of countries
│   ├── footer.tsx                # Site footer
│   ├── gallery-tour.tsx          # Homepage: 3D gallery preview link
│   ├── hero-section.tsx          # Homepage: Hero banner
│   ├── jury-section.tsx          # Homepage: Jury bios
│   ├── map-section.tsx           # Homepage: Country map
│   ├── participants-section.tsx  # Homepage: Participant count/stats
│   ├── participation-status.tsx  # User account status (signed out/in)
│   ├── site-header.tsx           # Site navigation header
│   ├── splash-screen.tsx         # Loading splash overlay
│   ├── workshop-section.tsx      # Homepage: Workshop info
│   ├── world-map.tsx             # Interactive country map
│   ├── artwork-search.tsx        # Homepage search bar
│   ├── share-artwork.tsx         # Share buttons for artwork
│   ├── clarity.tsx               # Clarity Analytics script
│   ├── vercel-analytics.tsx      # Vercel Analytics script
│   ├── referral-capture.tsx      # Capture referral param in session
│   └── track.tsx                 # Analytics event tracking
├── lib/                          # Server-side business logic & utilities
│   ├── supabase/                 # Database client factories
│   │   ├── server.ts             # createClient() for Server Components
│   │   ├── public.ts             # createPublicClient() (anon role)
│   │   ├── admin.ts              # Admin-specific client (service key)
│   │   ├── config.ts             # isSupabaseConfigured check
│   │   └── client.ts             # Browser client setup
│   ├── ar/                       # AR experience helpers
│   │   ├── mindar.ts             # MindAR setup + detection
│   │   ├── pieces.ts             # AR model definitions
│   │   ├── print-cards.tsx       # Print card PDF generation
│   │   └── targets.ts            # AR target image paths
│   ├── i18n/                     # Internationalization
│   │   ├── server.ts             # getI18n() for Server Components
│   │   ├── client.tsx            # I18nProvider for Client Components
│   │   ├── locales.ts            # Locale metadata (codes, names, flags)
│   │   ├── format.ts             # Format helpers (dates, numbers)
│   │   ├── messages/             # Message catalogs per language
│   │   │   ├── index.ts          # Export all messages
│   │   │   ├── client.ts         # Messages sent to browser
│   │   │   └── es.ts / en.ts / ... # Per-language translations
│   │   ├── messages.test.ts      # Test message loading
│   │   └── locales.test.ts       # Test locale detection
│   ├── data/                     # Static/imported data files
│   ├── admin.ts                  # ADMIN_EMAILS list
│   ├── site.ts                   # Site config (deadline, name, url)
│   ├── pricing.ts                # Entry fee calculations
│   ├── artwork-search.ts         # Search index building
│   ├── artwork-share-image.tsx   # OG image generation
│   ├── artwork-stats.ts          # Count stats (finalist, by country)
│   ├── campaign-audience.ts      # Filter profiles for email campaigns
│   ├── country-codes.ts          # ISO country code utilities
│   ├── country-breakdown.ts      # Aggregate stats by country
│   ├── entries.ts                # Submission entry management
│   ├── entry-payments.ts         # Payment amount lookup
│   ├── email-blocks.ts           # Reusable email template blocks
│   ├── email-translation.ts      # Email translation helpers
│   ├── email-translator.ts       # Translate email content
│   ├── exhibition-mail.ts        # Exhibition notification template
│   ├── finalists.ts              # Fetch published artworks (cached)
│   ├── funnel.ts                 # Funnel analytics & progression
│   ├── gallery-artworks.ts       # Daily selection for 3D gallery
│   ├── gallery-identity.ts       # Session identity for gallery
│   ├── gallery-return.ts         # Gallery return link generation
│   ├── google-sheets.ts          # Apps Script webhook handler
│   ├── instagram.ts              # Instagram URL parsing
│   ├── iso-numeric-country-codes.ts # ISO-3166-1 numeric codes
│   ├── legacy-submissions.ts     # Import from old system
│   ├── map-country-link.ts       # Map country → artist link
│   ├── mercadopago-signature.ts  # Webhook signature verification
│   ├── mercadopago.ts            # MercadoPago client setup
│   ├── name-format.ts            # Artist name normalization
│   ├── onboarding-input.ts       # Validation for onboarding form
│   ├── onboarding-image.ts       # Image upload URL generation
│   ├── participants.ts           # Country code ↔ name utilities
│   ├── referral-server.ts        # Referral link tracking (server)
│   ├── referral.ts               # Referral link utilities
│   ├── registro-sync.ts          # Sync with old Registro system
│   ├── registro.ts               # Registro client & parsing
│   ├── resend-signature.ts       # Resend webhook verification
│   ├── resend.ts                 # Resend email client
│   ├── reuse-registro-artwork.ts # Import artwork from Registro
│   ├── safe-next.ts              # Next.js internals workaround
│   ├── slug.ts                   # URL slug generation from title
│   ├── submissions.ts            # Submission status queries
│   ├── system-templates.ts       # Built-in email templates
│   ├── track-server.ts           # Analytics event logging (server)
│   ├── track.ts                  # Analytics event tracking
│   ├── flag-svg.ts               # Flag emoji/SVG utilities
│   ├── publish-legacy.ts         # Bulk publish imported artworks
│   ├── utils.ts                  # Misc utilities
│   ├── artist-digest.ts          # Artist email digest summary
│   ├── artist-digest.test.ts     # Tests for digest
│   ├── artwork-search.test.ts    # Tests for search
│   └── [many more .test.ts files] # Unit tests for lib functions
├── public/                       # Static assets
│   ├── ar/                       # AR target images (for MindAR)
│   ├── email/                    # Email template assets
│   ├── logo-mark.png             # Logo icon
│   └── [other images]
├── supabase/                     # Supabase config & migrations
│   ├── migrations/               # SQL migration files (timestamp_description.sql)
│   └── .temp/                    # Temporary migration files
├── scripts/                      # Utility scripts
│   ├── apps-script/              # Google Apps Script backups/code
│   └── [other scripts]
├── .github/workflows/            # CI/CD pipeline definitions
├── .local/                       # Local development data & backups
│   ├── contact-backups/          # Backup of contact submissions
│   ├── duplicate-audit/          # Data cleanup logs
│   ├── manual-fixes/             # Manual correction records
│   └── registro-backups/         # Old system data exports
├── .planning/codebase/           # This directory - codebase analysis docs
├── .claude/                      # Claude Code project config
│   └── worktrees/                # Claude Code agent isolation directories
├── .codex/                       # Codex/memory storage (if used)
├── .vercel/                      # Vercel deployment config
├── .env.example                  # Example environment variables
├── .env.local                    # (NOT committed) Actual secrets
├── .gitignore                    # Git ignore rules
├── package.json                  # Dependencies & scripts
├── package-lock.json             # Dependency lockfile
├── next.config.js                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration
├── vitest.config.ts              # Vitest (test runner) config
├── eslint.config.mjs             # ESLint configuration
└── README.md                     # Project documentation
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router pages, layouts, and API routes
- Pattern: Directory structure mirrors public URLs (e.g., `app/obras/[slug]/page.tsx` → `/obras/[slug]`)
- Auth: `app/admin/` is guarded by `layout.tsx` redirect if user not in ADMIN_EMAILS

**`components/`:**
- Purpose: Reusable React components organized by feature or domain
- Pattern: Subdirectories for major features (admin, gallery, ar); flat list for shared UI
- Import as: `import { ComponentName } from '@/components/feature-name'`

**`lib/`:**
- Purpose: Server-side business logic, queries, utilities, helpers
- Pattern: Mix of files—each module handles one concern (e.g., `gallery-artworks.ts`, `email-blocks.ts`)
- Used from: Pages (`async` components), API routes, Server Actions, other lib files
- Exports mostly async functions or data structures

**`lib/supabase/`:**
- Purpose: Supabase client initialization and configuration
- Key files:
  - `server.ts` — `createClient()` for Server Components (uses session cookie)
  - `public.ts` — `createPublicClient()` for anonymous queries (anon key)
  - `config.ts` — `isSupabaseConfigured()` check before any Supabase call

**`lib/i18n/`:**
- Purpose: Internationalization infrastructure and message catalogs
- Key files:
  - `server.ts` — `getI18n()` returns `{ locale, m }` in Server Components
  - `client.tsx` — `I18nProvider` for Client Components
  - `messages/` — Message catalogs per language (es.ts, en.ts, etc.)
  - `locales.ts` — Locale metadata (display names, flags, locale codes)

**`lib/ar/`:**
- Purpose: Augmented Reality helpers for print cards and artwork viewing
- Key files:
  - `mindar.ts` — MindAR setup and configuration
  - `pieces.ts` — AR model/3D object definitions
  - `print-cards.tsx` — PDF generation for print cards
  - `targets.ts` — AR target image paths

**`public/`:**
- Purpose: Static assets served directly
- Subdirs: `ar/` (AR targets), `email/` (email template images)
- Note: Image uploads are in Supabase Storage, not here

**`supabase/migrations/`:**
- Purpose: Database schema changes (SQL)
- Pattern: Timestamped files (e.g., `20260921040000_artworks.sql`)
- Applied on deploy via Supabase CLI

**`.local/`:**
- Purpose: Local development artifacts, backups, manual fixes
- Not committed; specific to developer machine
- Examples: backup CSVs of contact submissions, audit logs

## Key File Locations

**Entry Points:**

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Homepage with sections |
| `/onboarding` | `app/onboarding/page.tsx` | Artist signup/form |
| `/admin` | `app/admin/layout.tsx` | Admin panel auth guard |
| `/admin/obras` | `app/admin/obras/page.tsx` | Artwork curation |
| `/obras/[slug]` | `app/obras/[slug]/page.tsx` | Individual artwork |
| `/galeria-3d` | `app/galeria-3d/page.tsx` | 3D gallery |
| `/ar/[slug]` | `app/ar/[slug]/page.tsx` | AR viewer |

**Configuration:**

| Purpose | File |
|---------|------|
| Runtime secrets | `.env.local` |
| Environment example | `.env.example` |
| TypeScript paths | `tsconfig.json` → `@/*` = project root |
| Tailwind theming | `tailwind.config.ts` |
| Next.js config | `next.config.js` |
| ESLint rules | `eslint.config.mjs` |

**Core Logic:**

| Concern | File |
|---------|------|
| Get published artworks | `lib/finalists.ts` |
| Gallery daily selection | `lib/gallery-artworks.ts` |
| Email templates | `lib/system-templates.ts`, `lib/email-blocks.ts` |
| Payment verification | `lib/mercadopago-signature.ts`, `app/api/mercadopago/webhook/route.ts` |
| i18n setup | `lib/i18n/server.ts`, `lib/i18n/client.tsx` |
| Admin check | `lib/admin.ts` (list), `app/admin/layout.tsx` (guard) |
| Slug generation | `lib/slug.ts` |
| Country utilities | `lib/country-codes.ts`, `lib/participants.ts` |

**Testing:**

| Type | Location |
|------|----------|
| Unit tests | `lib/*.test.ts` (colocated with implementation) |
| Test runner config | `vitest.config.ts` |
| Test command | `npm test` (runs `vitest run`) |

## Naming Conventions

**Files:**
- **Components**: `PascalCase.tsx` (e.g., `Hero Section.tsx`, `AdminNav.tsx`)
- **Utilities/functions**: `kebab-case.ts` (e.g., `gallery-artworks.ts`, `email-blocks.ts`)
- **Tests**: `kebab-case.test.ts` (e.g., `artwork-stats.test.ts`)
- **Styles**: `kebab-case.module.css` for scoped styles (e.g., `gallery-theme.module.css`)

**Directories:**
- **Feature-based**: Lowercase, plural for collections (e.g., `components/gallery/`, `lib/ar/`)
- **Route segments**: Lowercase, with brackets for dynamic segments (e.g., `app/obras/[slug]/`)

**Functions:**
- **Async queries**: `get*()` (e.g., `getFinalists()`, `getI18n()`)
- **Actions/mutations**: Verb + noun (e.g., `createClient()`, `selectArtwork()`, `sendEmail()`)
- **Handlers**: `handle*()` or `on*()` (e.g., `handleSubmit()`, `onScrollChange()`)
- **Predicates**: `is*()`, `should*()` (e.g., `isSupabaseConfigured()`, `shouldPublish()`)
- **Formatters**: `format*()` or `*ToString()` (e.g., `formatDayMonth()`, `countryCodeToName()`)

**Variables:**
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `ADMIN_EMAILS`, `SELECT_COLUMNS`)
- **Other**: camelCase (e.g., `artworks`, `selectedProfile`)

**Types:**
- **Exported types**: PascalCase (e.g., `Finalist`, `ArtworkRow`)
- **Component props**: `{ComponentName}Props` (e.g., `GameProps`)

## Where to Add New Code

**New Feature (e.g., voting system):**
1. **Server logic**: Create `lib/voting.ts` with `getVoteCount()`, `submitVote()` functions
2. **API endpoint**: Create `app/api/voting/route.ts` with POST handler
3. **Component**: Create `components/voting-widget.tsx` to display votes and submit form
4. **Page integration**: Import component in relevant page (e.g., `app/obras/[slug]/page.tsx`)
5. **Tests**: Add `lib/voting.test.ts` with test cases

**New Admin Page:**
1. **Directory**: Create `app/admin/newfeature/`
2. **Page file**: Add `page.tsx` with Server Component + async data fetching
3. **Components**: Extract UI into `components/admin/new-feature-*.tsx`
4. **Navigation**: Add link to `components/admin/admin-sections.ts` object
5. **Tests**: Add component tests in `components/admin/new-feature.test.tsx`

**New Utility Function:**
1. **File**: Create `lib/feature-name.ts` if single function, or directory `lib/feature-name/` if multi-file
2. **Implementation**: Write pure function with JSDoc comments
3. **Export**: Named export (not default)
4. **Tests**: Colocate as `lib/feature-name.test.ts` with 100% branch coverage

**New Component:**
1. **File**: `components/feature-name.tsx` (if shared) or `components/feature/feature-name.tsx` (if domain-specific)
2. **Props interface**: Define `interface FeatureNameProps { ... }`
3. **Styling**: Inline Tailwind classes, or create `.module.css` if complex
4. **Export**: Named export
5. **Storybook**: (Optional) Consider adding to component library

**New Supabase Table/Field:**
1. **Migration file**: Create `supabase/migrations/TIMESTAMP_description.sql` with `CREATE TABLE` or `ALTER TABLE`
2. **Timestamp**: Use ISO 8601 format in filename (e.g., `20260930120000_`)
3. **RLS policies**: Add `CREATE POLICY` statements for row-level security
4. **Types**: Update `lib/supabase/` if creating client types (or rely on runtime inference)

**New Email Template:**
1. **Block library**: Add reusable block to `lib/email-blocks.ts` if not already present
2. **System template**: Add function to `lib/system-templates.ts` returning email structure
3. **Admin UI**: No code needed if using `campaign-composer.tsx` which loads blocks from DB
4. **Test**: Add test in `lib/email-blocks.test.ts` or new template test file

**New 3D Gallery Component:**
1. **File**: Create `components/gallery/feature-name.tsx` or `components/gallery/feature-name/index.tsx`
2. **State**: If ephemeral state needed, create Zustand store in same directory (e.g., `components/gallery/feature-name/store.ts`)
3. **Styling**: Create `.module.css` for scoped styles or use inline Tailwind
4. **Threaded**: Use `<mesh>` from `@react-three/fiber`, wrap in `<Suspense>` if heavy

## Special Directories

**`app/api/cron/`:**
- Purpose: Scheduled background jobs triggered by external services (Vercel Cron, Google Cloud Scheduler)
- Timing: Configured in Vercel project settings or via environment triggers
- Example: `app/api/cron/exhibition/route.ts` — runs daily to compute gallery selection
- Pattern: Each job is a `GET` route with `export const maxDuration = 60` (seconds)

**`components/gallery/`:**
- Purpose: 3D gallery (Three.js + Rapier physics + Zustand state)
- Complexity: High—coordinates renderer, physics, input, UI, realtime
- Key files:
  - `Game.tsx` — Main entry point, initializes scene
  - `world/` — Meshes, lighting, scene setup
  - `player/` — Player avatar mesh
  - `camera/` — Camera controller
  - `interaction/` + `store.ts` — Input handling + UI state
  - `minimap/` + `store.ts` — Minimap rendering + position tracking
  - `presence/` + `store.ts` — Multiplayer presence (Supabase Realtime)
  - `ui/` — UI panels, buttons, overlays (not Three.js meshes)

**`lib/i18n/messages/`:**
- Purpose: Nested translation object per language
- Structure: Each language file exports `Messages` type with nested keys (e.g., `m.common.untitled`, `m.onboarding.signInTitle`)
- Pattern: `getI18n()` returns `m` object; components use JSX `{m.section.key}` for strings
- Adding a new key: Update all language files to maintain parity

**`.env.local` (not committed):**
- Purpose: Store runtime secrets
- Example vars:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (secret)
  - `MERCADOPAGO_ACCESS_TOKEN` (secret)
  - `RESEND_API_KEY` (secret)
  - `ANTHROPIC_API_KEY` (if used)
- Rule: Never commit `.env.local`; use `.env.example` for template

**`supabase/migrations/`:**
- Purpose: Version-controlled database schema
- Usage: Applied in order by Supabase CLI on deploy
- Template:
  ```sql
  create table if not exists public.artworks (
    id uuid primary key,
    profile_id uuid not null,
    title text,
    is_selected boolean default false,
    created_at timestamp default now(),
    foreign key (profile_id) references profiles(id)
  );

  create policy "artworks: owner read own" on artworks
    for select using (auth.uid() = profile_id);
  ```

---

*Structure analysis: 2026-09-29*
