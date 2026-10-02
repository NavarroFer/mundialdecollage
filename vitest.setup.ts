import { vi } from 'vitest'

// unstable_cache needs Next's incremental cache, which only exists inside a
// running app: tests read the loaders straight through.
vi.mock('@/lib/public-data-cache', () => ({
  cachedPublicData: <T>(fn: T) => fn,
  refreshPublicData: vi.fn(),
}))
