# Testing Patterns

**Analysis Date:** 2026-09-29

## Test Framework

**Runner:**
- Vitest 5.0.1
- Config: `vitest.config.mts`
- Node environment (no jsdom/browser simulation)

**Assertion Library:**
- Vitest built-in (no external assertion library)
- Uses `expect()` from vitest

**Run Commands:**
```bash
npm run test                # Run all tests once
npm run test -- --watch    # Watch mode
npm run test -- --coverage # Coverage report
```

**Configuration:**
- Path alias: `@` resolves to repo root
- Excludes `.claude/**` (agent worktrees)
- Node environment for all tests

## Test File Organization

**Location:**
- Co-located with source: `[filename].test.ts` in same directory as source
- Not in separate `__tests__` directory
- Examples:
  - `lib/slug.ts` → `lib/slug.test.ts`
  - `lib/entries.ts` → `lib/entries.test.ts`
  - `lib/gallery-artworks.ts` → `lib/gallery-artworks.test.ts`

**Naming:**
- Test files: `[moduleName].test.ts`
- No `.spec.ts` files used in this codebase

**Structure:**
```
lib/
├── slug.ts
├── slug.test.ts
├── entries.ts
├── entries.test.ts
└── ...
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('lowercases and dashes plain ascii', () => {
    expect(slugify('Mateo Alviani')).toBe('mateo-alviani')
  })

  it('strips accents instead of dropping the letter', () => {
    expect(slugify('Sofía Ramírez')).toBe('sofia-ramirez')
  })
})
```

**Patterns:**
- `describe()` groups related tests (usually one per exported function/type)
- `it()` for individual test cases — use clear, descriptive names
- Test names describe expected behavior, not implementation
- Test names use present tense: "does X", "returns Y", "accepts Z"

**Cleanup:**
```typescript
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})
```

## Test Structure (Detailed Example)

From `lib/entries.test.ts`:
```typescript
import { describe, expect, it } from 'vitest'
import {
  entryExternalReference,
  entryLimit,
  entryPaymentOutcome,
  needsEntryChoice,
  parseExternalReference,
  resolveEntryChoice,
} from './entries'
import { site } from './site'

describe('entryLimit', () => {
  it('lets one obra take part for free and more after paying', () => {
    expect(entryLimit(false)).toBe(1)
    expect(entryLimit(true)).toBe(site.entries.paidLimit)
  })
})

describe('resolveEntryChoice', () => {
  const ownedIds = ['a', 'b', 'c']

  it('makes the single free choice the main obra', () => {
    expect(resolveEntryChoice({ ownedIds, requestedIds: ['b'], currentMainId: 'a', limit: 1 })).toEqual({
      ok: true,
      entered: ['b'],
      main: 'b',
    })
  })
})
```

## Mocking

**Framework:**
- Vitest's `vi` namespace for all mocking

**Module Mocking with vi.hoisted:**
```typescript
import { afterEach, describe, expect, it, vi } from 'vitest'

const supabase = vi.hoisted(() => ({ configured: false, rpc: vi.fn() }))

vi.mock('@/lib/supabase/config', () => ({
  get isSupabaseConfigured() { return supabase.configured },
}))

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({ rpc: supabase.rpc }),
}))

// Must import mocked modules AFTER vi.mock() calls
import { getDailyExhibition } from './gallery-artworks'
```

**Module Mocking Pattern:**
- Use `vi.hoisted()` to create setup before imports
- Call `vi.mock()` before importing the modules that depend on those mocks
- Import real implementations after mocking is set up

**Function Mocking:**
```typescript
vi.mocked(getFinalists).mockResolvedValue(finalists)
vi.mocked(getFinalistsByIds).mockResolvedValue(new Map([['id-3', finalists[3]]]))
vi.spyOn(console, 'error').mockImplementation(() => {})
```

**Mock Methods:**
- `.mockResolvedValue(value)` - resolve to value
- `.mockResolvedValueOnce(value)` - resolve to value one time, then revert
- `.mockImplementation(fn)` - use custom function
- `.toHaveBeenCalled()` - verify was called
- `.toHaveBeenCalledWith(args)` - verify was called with specific args

**What to Mock:**
- External dependencies (Supabase, APIs, file system)
- Time-dependent functions (use `vi.useFakeTimers()`)
- Functions with side effects
- Console methods when they're not being tested

**What NOT to Mock:**
- The function being tested itself
- Pure utility functions
- Date/time functions unless testing time-dependent logic

## Fixtures and Factories

**Test Data:**
```typescript
const finalists: Finalist[] = Array.from({ length: 40 }, (_, index) => ({
  slug: `obra-${index}`,
  name: `Artista ${index}`,
  countryCode: 'AR',
  artworkTitle: `Obra ${index}`,
  imageUrl: `/obra-${index}.jpg`,
}))
```

**Location:**
- Define test fixtures at top of test file after imports
- Use const with `Array.from()` or object literals
- Keep fixtures minimal — only include required fields
- Use factories (functions) for complex/reusable data

**Constants in Tests:**
```typescript
const purchase = { status: 'pending' as const, amount: 30000, currency: 'ARS' }
const secret = 'test-secret'
const paymentId = '123456789'
```

## Coverage

**Requirements:**
- No enforced coverage target in this codebase
- Tests focus on correctness over coverage percentage

**View Coverage:**
```bash
npm run test -- --coverage
```

## Test Types

**Unit Tests:**
- Test individual functions in isolation
- Mock external dependencies
- Test both success and failure paths
- Examples: `lib/slug.test.ts`, `lib/entries.test.ts`, `lib/pricing.test.ts`

**Integration Tests:**
- Test multiple functions working together
- May use real data or fixtures
- Examples: `lib/gallery-artworks.test.ts` tests exhibition logic with Supabase mocks

**E2E Tests:**
- Not used in this codebase (no Cypress, Playwright, etc.)
- API routes tested through unit tests of their logic

## Common Patterns

**Testing Success Path:**
```typescript
it('credits an approved payment for the full price', () => {
  expect(entryPaymentOutcome(
    { status: 'approved', transaction_amount: 30000, currency_id: 'ARS' },
    { status: 'pending', amount: 30000, currency: 'ARS' }
  )).toBe('paid')
})
```

**Testing Error Conditions:**
```typescript
it('does not credit a payment for less or in another currency', () => {
  expect(entryPaymentOutcome(
    { status: 'approved', transaction_amount: 100, currency_id: 'ARS' },
    purchase
  )).toBe('mismatch')
})

it('refuses what no handle can be', () => {
  expect(cleanInstagramInput('ana collage')).toBeNull()
  expect(cleanInstagramInput('a'.repeat(31))).toBeNull()
})
```

**Async Testing:**
```typescript
it('shows the stored lineup in wall order', async () => {
  supabase.configured = true
  supabase.rpc.mockResolvedValue({
    data: [{ slot: 0, artwork_id: 'id-7' }],
    error: null,
  })
  const result = await getDailyExhibition()
  expect(result).toHaveLength(1)
})
```

**Time-based Testing:**
```typescript
it('rotates at 09:00 Argentina', async () => {
  vi.useFakeTimers().setSystemTime(new Date('2026-09-23T08:59:59-03:00'))
  const today = await getDailyExhibition()
  
  vi.setSystemTime(new Date('2026-09-23T09:00:00-03:00'))
  expect(await getDailyExhibition()).not.toEqual(today)
})
```

**Testing Security-Critical Functions:**
```typescript
describe('verifyMercadoPagoSignature', () => {
  it('rejects a signature made with the wrong secret', () => {
    const v1 = crypto
      .createHmac('sha256', 'wrong-secret')
      .update(`id:${paymentId.toLowerCase()};...`)
      .digest('hex')
    expect(verifyMercadoPagoSignature({ paymentId, requestId, ts, v1, secret })).toBe(false)
  })

  it('rejects a malformed (non-hex or wrong-length) v1 without throwing', () => {
    expect(() =>
      verifyMercadoPagoSignature({ paymentId, requestId, ts, v1: 'not-hex!!', secret })
    ).not.toThrow()
  })
})
```

**Edge Cases:**
- Test with null/undefined: `cleanInstagramInput('   ')` → `''`
- Test with extreme values: `cleanInstagramInput('a'.repeat(31))` → `null`
- Test with non-Latin characters: `slugify('田中太郎')` → `''`
- Test state transitions: Payment moves from `pending` → `paid`, never back

## Assertion Patterns

**Primitives:**
```typescript
expect(value).toBe(expected)
```

**Objects:**
```typescript
expect(result).toEqual({ ok: true, entered: ['b'], main: 'b' })
```

**Partial Object Matching:**
```typescript
expect(resolveEntryChoice(...)).toMatchObject({ main: 'c' })
```

**Collections:**
```typescript
expect(result).toHaveLength(20)
expect(new Set(ids).size).toBe(expectedSize)
```

**Nulls/Undefined:**
```typescript
expect(cleanInstagramInput('ana collage')).toBeNull()
```

**Functions:**
```typescript
expect(getFinalists).not.toHaveBeenCalled()
expect(supabase.rpc).toHaveBeenCalledWith('ensure_exhibition_today')
```

## Test Writing Guidelines

1. **Test behavior, not implementation** — Test what the function does, not how
2. **One assertion per test** — Generally; multiple related assertions are OK
3. **Use descriptive names** — Test names should make failures obvious
4. **Setup minimal data** — Only include fields actually used
5. **Clean up after each test** — `afterEach()` block for mocks, timers, state
6. **Test edge cases** — Empty strings, large numbers, null values, wrong types
7. **Test security paths** — Authentication, authorization, signature verification
8. **Document assumptions** — Comments explain non-obvious edge cases
9. **No hardcoded magic numbers** — Use constants: `const ENTRY_PREFIX = 'entry:'`

---

*Testing analysis: 2026-09-29*
