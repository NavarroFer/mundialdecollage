import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ client: vi.fn() }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: mocks.client }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/render-mode', () => ({ isAnonymousRender: vi.fn() }))
vi.mock('@/lib/public-data-cache', () => ({ cachedPublicData: <T,>(fn: T) => fn }))
vi.mock('react', async (original) => ({ ...await original<typeof import('react')>(), cache: <T,>(fn: T) => fn }))
import { getFinalistIndex, getFinalists } from './finalists'

const row = (n: number) => ({ slug: `obra-${n}`, title: null, technique: null, image_url: `https://x/${n}.jpg`, profiles: { id: `p${n}`, name: `Artista ${n}`, country_code: 'AR', instagram: null, website: null } })

// Answers like PostgREST: never more than 1000 rows per request.
function database(total: number, failFrom?: number) {
  const rows = Array.from({ length: total }, (_, n) => row(n))
  const ranges: [number, number][] = []
  const orders: string[] = []
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: (column: string) => { orders.push(column); return builder },
    range: async (from: number, to: number) => {
      ranges.push([from, to])
      if (failFrom !== undefined && from >= failFrom) return { data: null, error: { message: 'down' } }
      return { data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }
    },
  }
  mocks.client.mockReturnValue({ from: () => builder })
  return { ranges, orders }
}

beforeEach(() => vi.clearAllMocks())

it('lists every published obra past the 1000 rows of one response', async () => {
  const { ranges, orders } = database(1118)
  const list = await getFinalists()
  expect(list).toHaveLength(1118)
  expect(new Set(list.map((obra) => obra.slug)).size).toBe(1118)
  expect(ranges).toEqual([[0, 999], [1000, 1999]])
  expect(orders.slice(0, 2)).toEqual(['created_at', 'id'])
})

it('stops after one request when the first page is not full', async () => {
  const { ranges } = database(40)
  expect(await getFinalists()).toHaveLength(40)
  expect(ranges).toHaveLength(1)
})

it('builds the obra navigation index from all of them too', async () => {
  database(1118)
  expect(await getFinalistIndex()).toHaveLength(1118)
})

it('never serves a partial listing when a later page fails', async () => {
  database(1118, 1000)
  expect(await getFinalists()).toEqual([])
  database(1118, 1000)
  await expect(getFinalistIndex()).rejects.toThrow('down')
})
