# Coding Conventions

**Analysis Date:** 2026-09-29

## Naming Patterns

**Files:**
- Component files: kebab-case (e.g., `components/countdown.tsx`, `components/admin/page-header.tsx`)
- Module files: kebab-case (e.g., `lib/slug.ts`, `lib/entries.ts`, `lib/gallery-return.ts`)
- Test files: match source name with `.test.ts` or `.test.tsx` suffix (e.g., `lib/slug.test.ts`)

**Functions:**
- Regular functions: camelCase (e.g., `slugify()`, `entryLimit()`, `normalizeWebsite()`)
- Helper/internal functions: camelCase, not exported (e.g., `getTimeLeft()` in `components/countdown.tsx`)

**Components:**
- React components: PascalCase (e.g., `Countdown`, `AdminPageHeader`, `StatPill`)
- Component files use kebab-case names (e.g., `countdown.tsx` exports `Countdown`)

**Variables & Properties:**
- Local variables: camelCase
- Object properties: camelCase
- CSS classes: Tailwind utility classes and lowercase dash-separated custom classes

**Constants:**
- Module-level constants: SCREAMING_SNAKE_CASE (e.g., `ENTRY_PREFIX`, `GOLDEN_RATIO_CONJUGATE`, `ROTATION_OFFSET_MS`)
- Example from `lib/gallery-artworks.ts`: `const EDITION_YEAR = new Date(site.deadlineISO).getFullYear()`
- Example from `lib/entries.ts`: `const ENTRY_PREFIX = 'entry:'`

**Types:**
- Type names: PascalCase (e.g., `GalleryIntent`, `GalleryReturn`, `EntryChoice`, `Finalist`)
- Import types with `type` keyword: `import type { Finalist } from '@/lib/finalists'`

## Code Style

**Formatting:**
- ESLint with Next.js core-web-vitals config (`eslint.config.mjs`)
- No Prettier config — rely on ESLint rules
- TypeScript strict mode enabled (`tsconfig.json`)

**Linting:**
- ESLint enforces Next.js best practices
- Config: `eslint.config.mjs` uses `eslint-config-next/core-web-vitals`
- Run with: `npm run lint`

**Type Safety:**
- TypeScript `strict: true` in `tsconfig.json`
- All function parameters and returns should have explicit types
- Use union types for discriminated unions: `{ ok: true; value: T } | { ok: false; error: string }`
- Use `type` keyword for type-only imports

**Styling:**
- Tailwind CSS for all styles (`@tailwindcss/postcss` and `tailwindcss` 4.2.0)
- Use Tailwind utilities directly in className attribute
- No separate CSS files — style inline with className
- Example from `components/countdown.tsx`:
  ```tsx
  <div className="inline-flex items-center gap-3 rounded-2xl border-2 border-ink/15 bg-card/80 px-4 py-3 shadow-sm">
  ```

## Import Organization

**Order:**
1. Next.js built-in imports (next/cache, next/navigation, etc.)
2. React imports (from 'react')
3. Local imports with @/ path alias
4. Type imports with `type` keyword

**Example from `app/onboarding/actions.ts`:**
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
```

**Path Aliases:**
- @ resolves to repository root (configured in `tsconfig.json`)
- Use @ for all local imports, even in nested files: `import { slugify } from '@/lib/slug'`
- Aliases set in `tsconfig.json`: `"@/*": ["./*"]`

## Error Handling

**Union Type Returns:**
- For operations that can fail, return discriminated unions instead of throwing
- Pattern: `{ ok: true; data: T } | { ok: false; error: string }`
- Example from `lib/entries.ts`:
  ```typescript
  export type EntryChoice =
    | { ok: true; entered: string[]; main: string }
    | { ok: false; error: 'none' | 'too_many' | 'not_owned' }
  ```

**Throwing Errors:**
- Throw `Error` with descriptive, user-facing messages (often in Spanish for this project)
- Example from `lib/google-sheets.ts`: `throw new Error('Faltan credenciales de la cuenta de servicio de Google.')`
- Throws include context about what failed and why

**Silent Catches:**
- Use `} catch {}` when operation failure is acceptable (storage operations, optional side effects)
- Example from `lib/gallery-return.ts`:
  ```typescript
  export function saveCommentDraft(slug: string, text: string) {
    try {
      if (text.trim()) sessionStorage.setItem(draftKey(slug), text)
      else sessionStorage.removeItem(draftKey(slug))
    } catch {}  // Storage can be off or full — losing the draft is acceptable
  }
  ```

**API Route Errors:**
- Use `NextResponse` with appropriate status codes
- Example from `app/api/unsubscribe/route.ts`:
  ```typescript
  if (!id || !isSupabaseConfigured) {
    return new NextResponse('Falta el identificador.', { status: 400 })
  }
  ```

## Comments

**When to Comment:**
- Explain WHY something is done, not WHAT (code speaks for itself)
- Explain design decisions and their reasoning
- Document algorithms and non-obvious logic
- Explain security considerations
- Reference related files and database schemas/migrations

**JSDoc Style:**
- Use `/** */` for public function/type documentation
- Provide one-line summary of purpose
- Example from `lib/pricing.ts`:
  ```typescript
  /**
   * Given the net amount you want to end up with after Mercado Pago's fee,
   * returns the gross price to charge the buyer so the fee doesn't cut into it.
   * netAmount=10000, feePercent=3.99 -> ~10415.
   */
  export function priceWithFee(netAmount: number, feePercent: number) {
    // ...
  }
  ```

**Multi-line Comments:**
- Use `//` for block comments explaining design, algorithms, or edge cases
- Example from `lib/gallery-artworks.ts`:
  ```typescript
  // Golden ratio conjugate — multiplying an index by it and keeping the
  // fractional part is a classic low-discrepancy ("Weyl") sequence: it spreads
  // items out evenly while still looking arbitrary, and it's fully
  // deterministic from the seed alone (no state to store or cron to run).
  const GOLDEN_RATIO_CONJUGATE = 0.6180339887498949
  ```

**Comments Reference Context:**
- Reference database migrations: `supabase/migrations/20260926130000_artwork_entries.sql`
- Reference related code files: `app/onboarding/actions.ts`
- Reference caller responsibilities: `slug.test.ts` comments explain that caller is responsible for fallback

## Function Design

**Size Guidelines:**
- Keep functions focused and small
- One responsibility per function
- If a function needs extensive comments explaining what it does, it's likely too complex

**Parameters:**
- Use object parameter pattern for functions with multiple parameters
- Example from `lib/entries.ts`:
  ```typescript
  export function resolveEntryChoice({
    ownedIds,
    requestedIds,
    mainId,
    currentMainId,
    limit,
  }: {
    ownedIds: string[]
    requestedIds: string[]
    mainId?: string | null
    currentMainId?: string | null
    limit: number
  }): EntryChoice
  ```

**Return Values:**
- Use explicit return types on all functions
- Prefer narrow return types over broad ones
- Use union types for operations that can fail
- Never return both success and failure states mixed in same field

## Module Design

**Exports:**
- Export named functions/types, not default exports
- Each module should export related functionality
- Keep exports focused — separate concerns into different files

**Barrel Files:**
- Not commonly used in this codebase — prefer direct imports
- This keeps dependency trees clear and speeds up type checking

**File Organization:**
- Constants at module level (SCREAMING_SNAKE_CASE)
- Exported types after constants
- Exported functions after types
- Helper functions last (not exported)
- Test files co-located with source

---

*Convention analysis: 2026-09-29*
