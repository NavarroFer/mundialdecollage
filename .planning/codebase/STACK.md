# Technology Stack

**Analysis Date:** 2026-09-29

## Languages

**Primary:**
- TypeScript 5.7.3 - All source code in `app/`, `components/`, `lib/`, and scripts
- JavaScript/JSX - Component implementation with React 19
- CSS 3 - Tailwind CSS classes with custom properties (CSS variables) for branding

**Secondary:**
- SQL - Supabase migrations in `supabase/migrations/`

## Runtime

**Environment:**
- Node.js 22 (pinned in `.github/workflows/ci.yml:16`)
- Next.js 16.3.5 (see `package.json:31` and AGENTS.md note on breaking changes)

**Package Manager:**
- npm 
- Lockfile: `package-lock.json` present (lockfileVersion 3)

## Frameworks

**Core:**
- Next.js 16.3.5 - Full-stack React framework with App Router (`app/` directory)
- React 19.2.8 - UI components and state management with hooks
- React-DOM 19.2.8 - DOM rendering

**3D/Graphics:**
- Three.js 0.186.0 - 3D graphics engine for 3D gallery (`@react-three/fiber`, `@react-three/drei`)
- React Three Fiber 9.7.0 - React renderer for Three.js
- React Three Rapier 2.2.0 - Physics engine integration for 3D scenes
- GSAP 3.15.0 - Animation timeline library

**Styling & UI:**
- Tailwind CSS 4.2.0 - Utility-first CSS framework with `@tailwindcss/postcss` v4.2.0
- PostCSS 8.5.x - CSS processing pipeline
- Radix UI - React Dialog (`@radix-ui/react-dialog` v1.1.23), Slot (`@radix-ui/react-slot` v1.2.4)
- Lucide React 0.564.0 - Icon library
- Class-variance-authority 0.7.1 - Component variant management
- clsx 2.1.1 - Conditional className utility

**Testing:**
- Vitest 5.0.1 - Unit/integration test runner (config: `vitest.config.mts`)
- Vite 7.1.12 - Test environment build tool

**Build/Dev:**
- Next.js built-in Webpack bundler
- ESLint 9.x - Linting with `eslint-config-next` 16.3.5
- TypeScript 5.7.3 compiler

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.116.0 - Supabase client for database, auth, and storage
- @supabase/ssr 0.12.7 - Server-side rendering support for Supabase auth
- mercadopago 3.6.1 - MercadoPago payment processing SDK
- resend 6.28.1 - Email delivery service client
- @anthropic-ai/sdk 0.128.0 - Claude API for email translation

**Utilities:**
- zustand 5.0.15 - Lightweight state management
- qrcode 1.5.4 - QR code generation
- pdf-lib 1.17.1 - PDF creation and manipulation
- sharp 0.35.4 - Image processing (resizing on upload)
- react-simple-maps 5.0.5 - World map rendering
- country-flag-icons 1.6.20 - Flag SVG assets
- @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0, @dnd-kit/utilities 3.2.2 - Drag-and-drop functionality

**Analytics & Performance:**
- @vercel/analytics 2.0.1 - Vercel Web Analytics integration

## Configuration

**Environment:**
- Next.js configuration: `next.config.mjs` with image optimization disabled, Supabase Storage remote patterns, Cloudflare tunnel support for dev
- TypeScript: `tsconfig.json` with strict mode, path aliases (`@/*`)
- ESLint: `eslint.config.mjs` using Next.js core web vitals config with agent worktrees ignored
- PostCSS: `postcss.config.mjs` with Tailwind CSS plugin
- Vitest: `vitest.config.mts` with `@/` path alias, node test environment

**Environment Files:**
- `.env.local` present - contains secrets (never committed)
- Required public vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLARITY_PROJECT_ID`
- Required private vars: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_*`

**Build:**
- `tsconfig.json` - TypeScript compilation target ES6, strict mode enabled
- `next.config.mjs` - Image optimization (unoptimized: true), remote image patterns for Supabase Storage
- Component definitions: `components.json` (Shadcn/ui reference)

## Platform Requirements

**Development:**
- Node.js 22+
- npm 9+ (implied by lockfileVersion 3)

**Production:**
- Vercel (primary deployment target)
  - Next.js Cron Jobs configured in `vercel.json` (registration daily at 12:00 UTC, exhibition daily at 12:05 UTC)
  - Cloudflare Tunnel support for dev HTTPS (via `allowedDevOrigins` in next.config.mjs)

---

*Stack analysis: 2026-09-29*
