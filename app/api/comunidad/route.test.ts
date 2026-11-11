import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeCursor } from '@/lib/community'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/posts/${path}` } }) }) },
  }),
}))

import { GET as getFeed } from './route'
import { GET as getPost } from './[id]/route'

const id = '11111111-2222-4333-8444-555555555555'
const other = '22222222-3333-4444-8555-666666666666'
const profile = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function row(over: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'photo',
    body: 'Hola',
    created_at: '2026-11-11T18:00:00.000Z',
    like_count: 0,
    comment_count: 0,
    profile_id: profile,
    author_name: 'Ana',
    author_country: 'AR',
    author_thumb: null,
    artwork_slug: null,
    artwork_title: null,
    image_url: null,
    image_path: `${profile}/foto.jpg`,
    official: false,
    pinned: false,
    lang: 'es',
    translations: {},
    image_alt: null,
    tags: [],
    ...over,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
})

describe('GET /api/comunidad', () => {
  it('is cached at the CDN and does not read the session', () => {
    for (const file of ['app/api/comunidad/route.ts', 'app/api/comunidad/[id]/route.ts']) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/next\/headers|lib\/supabase\/server|force-dynamic|export const revalidate|unstable_cache/)
    }
  })

  it('answers with s-maxage and a cursor when another page remains', async () => {
    const newer = row({ id, created_at: '2026-11-11T18:00:00.000Z' })
    const older = row({ id: other, created_at: '2026-11-11T17:00:00.000Z' })
    mocks.rpc.mockResolvedValue({ data: [newer, older], error: null })
    const response = await getFeed(new Request('https://site.test/api/comunidad?n=1&lang=es'))
    expect(response.headers.get('cache-control')).toContain('s-maxage=60')
    expect(mocks.rpc).toHaveBeenCalledWith('community_feed', expect.objectContaining({ page_size: 2, author: null }))
    const body = await response.json()
    expect(body.posts).toHaveLength(1)
    expect(body.posts[0].imageUrl).toBe(`https://cdn.test/posts/${profile}/foto.jpg`)
    expect(body.next).toBe(encodeCursor(newer.created_at, newer.id))
  })

  it('asks for the home strip without a cursor', async () => {
    mocks.rpc.mockResolvedValue({ data: [row({ pinned: true })], error: null })
    const response = await getFeed(new Request('https://site.test/api/comunidad?destacadas=1&n=6'))
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('community_highlights', { page_size: 6 })
    expect((await response.json()).next).toBeNull()
  })

  it('returns 400, still cacheable, for a bad cursor', async () => {
    const response = await getFeed(new Request('https://site.test/api/comunidad?antes=nope'))
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('does not cache a database failure', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'down' } })
    const response = await getFeed(new Request('https://site.test/api/comunidad'))
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

describe('GET /api/comunidad/[id]', () => {
  it('returns one post with s-maxage, and 404 when it is gone', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [row()], error: null })
    const found = await getPost(new Request(`https://site.test/api/comunidad/${id}`), { params: Promise.resolve({ id }) })
    expect(found.status).toBe(200)
    expect(found.headers.get('cache-control')).toContain('s-maxage=60')
    expect((await found.json()).id).toBe(id)

    mocks.rpc.mockResolvedValueOnce({ data: [], error: null })
    const missing = await getPost(new Request(`https://site.test/api/comunidad/${id}`), { params: Promise.resolve({ id }) })
    expect(missing.status).toBe(404)
    expect(missing.headers.get('cache-control')).toContain('s-maxage=60')
  })

  it('rejects an id that is not a uuid', async () => {
    const response = await getPost(new Request('https://site.test/api/comunidad/nope'), { params: Promise.resolve({ id: 'nope' }) })
    expect(response.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
