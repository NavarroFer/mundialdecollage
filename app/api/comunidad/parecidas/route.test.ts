import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn() }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.maybeSingle = mocks.maybeSingle
  return {
    createAdminClient: () => ({
      from: () => chain,
      rpc: mocks.rpc,
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    }),
  }
})

import { GET } from './route'

const request = (query: string) => new Request(`https://x.test/api/comunidad/parecidas?${query}`)

describe('GET /api/comunidad/parecidas', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.maybeSingle.mockReset()
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test')
  })

  it('rejects a request with nothing to compare', async () => {
    expect((await GET(request(''))).status).toBe(400)
  })

  it('answers an obra with obras, cached for a day, the same for everyone', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { slug: 'mar-a', tags: ['mar'] } })
    mocks.rpc.mockResolvedValue({ data: [{ slug: 'mar-b', title: 'Mar B', image_url: 'https://x.test/b.jpg', author_name: 'Beto' }], error: null })
    const response = await GET(request('slug=mar-a'))
    expect(mocks.rpc).toHaveBeenCalledWith('obra_similar', { match_tags: ['mar'], skip_slug: 'mar-a', page_size: 6 })
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=86400')
    expect(response.headers.get('Vary')).toBeNull()
    expect(await response.json()).toEqual({ obras: [{ slug: 'mar-b', title: 'Mar B', imageUrl: 'https://x.test/b.jpg', author: 'Beto' }] })
  })

  it('does not cache a database failure', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { slug: 'mar-a', tags: ['mar'] } })
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const response = await GET(request('slug=mar-a'))
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
