import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mocks.from,
    storage: { from: () => ({ list: mocks.list, remove: mocks.remove }) },
  }),
}))

import { communityViewer, deletePost, publishArtwork, publishImage, togglePostLike } from './actions'

const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const postId = '11111111-2222-4333-8444-555555555555'
const artworkId = '99999999-8888-4777-8666-555555555555'
const file = '11111111-2222-4333-8444-555555555555.jpg'
const user = { id: userId, email: 'ana@example.com' }

function result(data: unknown, error: { code?: string; message?: string } | null = null) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  for (const method of ['select', 'eq', 'in', 'neq', 'is', 'order', 'limit', 'insert', 'update', 'delete']) {
    builder[method] = vi.fn(chain)
  }
  const payload = { data, error }
  builder.maybeSingle = vi.fn(async () => payload)
  builder.single = vi.fn(async () => payload)
  builder.then = (resolve: (value: typeof payload) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(payload).then(resolve, reject)
  return builder
}

let queue: Record<string, Array<{ data: unknown; error?: { code?: string; message?: string } | null }>>

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret')
  mocks.getUser.mockResolvedValue({ data: { user } })
  mocks.list.mockResolvedValue({ data: [{ name: file }], error: null })
  mocks.remove.mockResolvedValue({ error: null })
  queue = {}
  mocks.from.mockImplementation((table: string) => {
    const next = queue[table]?.shift() ?? { data: null, error: null }
    return result(next.data, next.error ?? null)
  })
})

function artist() {
  queue.profiles = [{ data: { onboarded_at: '2026-01-01', is_public: true } }]
}

describe('publishArtwork', () => {
  it('asks to sign in first', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect(await publishArtwork({ artworkSlug: 'recortes' })).toEqual({ error: 'signin' })
  })

  it('refuses someone who is not an onboarded public artist', async () => {
    queue.profiles = [{ data: { onboarded_at: null, is_public: false } }]
    expect(await publishArtwork({ artworkSlug: 'recortes' })).toEqual({ error: 'not_artist' })
  })

  it('reports an obra that was already posted', async () => {
    artist()
    queue.artworks = [{ data: { id: artworkId } }]
    queue.posts = [{ data: null, error: { code: '23505', message: 'posts_artwork_once' } }]
    expect(await publishArtwork({ artworkSlug: 'recortes', body: '  hola  ' })).toEqual({ error: 'already' })
  })

  it('maps the database limit to rate_limited and never marks a post official', async () => {
    artist()
    queue.artworks = [{ data: { id: artworkId } }]
    queue.posts = [{ data: null, error: { code: 'P0001', message: 'rate_limited' } }]
    expect(await publishArtwork({ artworkSlug: 'recortes' })).toEqual({ error: 'rate_limited' })
    const insert = mocks.from.mock.results.at(-1)?.value.insert
    expect(insert).toHaveBeenCalledWith(expect.not.objectContaining({ official: expect.anything(), pinned_until: expect.anything() }))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'artwork', artwork_id: artworkId, body: '', status: 'published' }))
  })
})

describe('publishImage', () => {
  it('rejects a path outside the caller folder', async () => {
    expect(await publishImage({ kind: 'souvenir', path: `${postId}/${file}` })).toEqual({ error: 'bad_image' })
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('rejects a file that never reached Storage', async () => {
    artist()
    mocks.list.mockResolvedValue({ data: [], error: null })
    expect(await publishImage({ kind: 'photo', path: `${userId}/${file}` })).toEqual({ error: 'bad_image' })
  })
})

describe('togglePostLike and deletePost', () => {
  it('asks to sign in before liking', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect(await togglePostLike(postId)).toEqual({ error: 'signin' })
  })

  it('likes a published post and returns the new count', async () => {
    queue.posts = [{ data: { id: postId, status: 'published' } }, { data: { like_count: 4 } }]
    queue.post_likes = [{ data: null }, { data: null, error: null }]
    expect(await togglePostLike(postId)).toEqual({ ok: true, liked: true, likes: 4 })
  })

  it('lets only the author remove a post, without a moderation stamp', async () => {
    queue.posts = [{ data: { id: postId, profile_id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee', image_path: null, status: 'published' } }]
    expect(await deletePost(postId)).toEqual({ error: 'not_found' })

    queue.posts = [
      { data: { id: postId, profile_id: userId, image_path: `${userId}/${file}`, status: 'published' } },
      { data: null, error: null },
    ]
    expect(await deletePost(postId)).toEqual({ ok: true })
    const update = mocks.from.mock.results.at(-1)?.value.update
    expect(update).toHaveBeenCalledWith({ status: 'removed' })
    expect(mocks.remove).toHaveBeenCalledWith([`${userId}/${file}`])
  })
})

describe('communityViewer', () => {
  it('stays signed out without a session', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect(await communityViewer()).toEqual({
      signedIn: false, canPost: false, liked: [], mine: [], artworkPostId: null, unpostedArtworkSlug: null, taste: {},
    })
  })

  it('points an artist at the obra they have not posted yet', async () => {
    artist()
    queue.artworks = [{ data: { id: artworkId, slug: 'recortes' } }]
    queue.posts = [{ data: null }]
    const viewer = await communityViewer()
    expect(viewer).toMatchObject({ signedIn: true, canPost: true, unpostedArtworkSlug: 'recortes', taste: {} })
  })
})
