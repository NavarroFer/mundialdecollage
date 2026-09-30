import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), sessionRpc: vi.fn(), getUser: vi.fn(), from: vi.fn(), publicFrom: vi.fn() }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.sessionRpc }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({ from: mocks.publicFrom }) }))
import { addArtworkComment, collectArtworkStamp, getArtworkSocial, likeArtwork } from './actions'

// A chainable stand-in for a supabase-js query that resolves to `result`.
function query(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'gte', 'order', 'limit', 'insert']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => result)
  chain.single = vi.fn(async () => result)
  chain.then = (resolve: (value: unknown) => void) => resolve(result)
  return chain
}

const user = { id: 'u1', email: 'Ana@Example.com', user_metadata: { full_name: 'Ana Pérez' } }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret')
  mocks.getUser.mockResolvedValue({ data: { user: null } })
  mocks.rpc.mockResolvedValue({ error: null })
  mocks.sessionRpc.mockReturnValue({ single: vi.fn(async () => ({ data: { status: 'collected', remaining: 2, resets_at: '2026-10-01T00:00:00Z' }, error: null })) })
  mocks.publicFrom.mockReturnValue(query({ data: { id: 'artwork-1' }, error: null }))
})

describe('gallery artwork stamps', () => {
  it('asks anonymous visitors to sign in', async () => {
    expect(await collectArtworkStamp('obra')).toEqual({ error: 'sign_in_required' })
  })

  it('collects an available stamp through the quota RPC', async () => {
    mocks.getUser.mockResolvedValue({ data: { user } })
    expect(await collectArtworkStamp('obra')).toEqual({ status: 'collected', remaining: 2, resetsAt: '2026-10-01T00:00:00Z' })
    expect(mocks.sessionRpc).toHaveBeenCalledWith('collect_gallery_artwork_stamp', { artwork_slug: 'obra' })
  })
})

describe('gallery likes', () => {
  it('asks anonymous visitors to sign in instead of saving', async () => {
    expect(await likeArtwork('obra')).toEqual({ error: 'sign_in_required' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('likes with the Google account email, normalized', async () => {
    mocks.getUser.mockResolvedValue({ data: { user } })
    expect(await likeArtwork('obra')).toEqual({ liked: true })
    expect(mocks.rpc).toHaveBeenCalledWith('like_gallery_artwork', { artwork_slug: 'obra', voter_email: 'ana@example.com' })
  })

  it('does not claim success when the transaction fails', async () => {
    mocks.getUser.mockResolvedValue({ data: { user } })
    mocks.rpc.mockResolvedValue({ error: { message: 'failure' } })
    expect(await likeArtwork('obra')).toEqual({ error: 'save_failed' })
  })
})

describe('gallery comments', () => {
  it('asks anonymous visitors to sign in', async () => {
    expect(await addArtworkComment('obra', 'Hermosa')).toEqual({ error: 'sign_in_required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects empty and overly long comments before touching the database', async () => {
    mocks.getUser.mockResolvedValue({ data: { user } })
    expect(await addArtworkComment('obra', '   ')).toEqual({ error: 'empty' })
    expect(await addArtworkComment('obra', 'a'.repeat(501))).toEqual({ error: 'too_long' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stores a pending comment signed with the Google name', async () => {
    mocks.getUser.mockResolvedValue({ data: { user } })
    const insert = query({
      data: { id: 'c1', author_name: 'Ana Pérez', body: 'Hermosa', created_at: '2026-09-26T12:00:00Z', status: 'pending' },
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') return query({ data: null, error: null })
      return {
        select: () => query({ count: 0, error: null }),
        insert: (row: unknown) => {
          expect(row).toMatchObject({ artwork_id: 'artwork-1', user_id: 'u1', author_name: 'Ana Pérez', author_email: 'ana@example.com', body: 'Hermosa' })
          return insert
        },
      }
    })
    expect(await addArtworkComment('obra', '  Hermosa ')).toEqual({
      comment: { id: 'c1', author: 'Ana Pérez', body: 'Hermosa', createdAt: '2026-09-26T12:00:00Z', pending: true },
    })
  })

  it('stops someone flooding the moderation queue', async () => {
    mocks.getUser.mockResolvedValue({ data: { user } })
    mocks.from.mockReturnValue({ select: () => query({ count: 5, error: null }) })
    expect(await addArtworkComment('obra', 'Otra más')).toEqual({ error: 'rate_limited' })
  })
})

describe('invite to send an obra', () => {
  // Likes and comments answer empty; `profile` is what the profiles read returns.
  function tables(profile: unknown) {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') return query(profile)
      if (table === 'artwork_likes') return query({ count: 2, data: null, error: null })
      return query({ data: [], error: null })
    })
  }

  it('is not offered to anonymous visitors', async () => {
    tables({ data: null, error: null })
    expect(await getArtworkSocial('obra')).toMatchObject({ canJoin: false, like: { count: 2, signedIn: false } })
    expect(mocks.from).not.toHaveBeenCalledWith('profiles')
  })

  it('is offered to a signed-in visitor who never sent an obra', async () => {
    mocks.getUser.mockResolvedValue({ data: { user } })
    tables({ data: null, error: null })
    expect(await getArtworkSocial('obra')).toMatchObject({ canJoin: true, like: { signedIn: true } })
  })

  it('is not offered to artists already taking part', async () => {
    mocks.getUser.mockResolvedValue({ data: { user } })
    tables({ data: { onboarded_at: '2026-09-20T10:00:00Z' }, error: null })
    expect(await getArtworkSocial('obra')).toMatchObject({ canJoin: false })
  })

  it('is not offered to admins', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...user, email: 'MundialDeCollage@gmail.com' } } })
    tables({ data: null, error: null })
    expect(await getArtworkSocial('obra')).toMatchObject({ canJoin: false })
    expect(mocks.from).not.toHaveBeenCalledWith('profiles')
  })

  it('stays quiet when the profile cannot be read, without losing likes and comments', async () => {
    mocks.getUser.mockResolvedValue({ data: { user } })
    tables({ data: null, error: { message: 'failure' } })
    expect(await getArtworkSocial('obra')).toMatchObject({ canJoin: false, like: { count: 2 }, comments: { comments: [] } })
  })
})
