import { vi } from 'vitest'

// A placeholder Next's compiler replaces (it throws when imported as is):
// outside a page render there's no locale segment to read.
vi.mock('next/root-params', () => ({ locale: async () => undefined }))

// unstable_cache needs Next's incremental cache, which only exists inside a
// running app: tests read the loaders straight through.
vi.mock('@/lib/public-data-cache', () => ({
  cachedPublicData: <T>(fn: T) => fn,
  refreshPublicData: vi.fn(),
}))
