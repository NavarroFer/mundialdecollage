import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), get: vi.fn(), set: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.get, set: mocks.set }) }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
import { likeArtwork } from './actions'
import { signGalleryIdentity } from '@/lib/gallery-identity'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret')
  mocks.getUser.mockResolvedValue({ data: { user: null } })
  mocks.rpc.mockResolvedValue({ error: null })
})
describe('gallery likes', () => {
  it('requires an email before an anonymous vote', async () => {
    expect(await likeArtwork('obra')).toMatchObject({ needsEmail: true })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('normalizes guest email and remembers it only after success', async () => {
    expect(await likeArtwork('obra', ' A@Example.com ')).toEqual({ liked: true })
    expect(mocks.rpc).toHaveBeenCalledWith('like_gallery_artwork', { artwork_slug: 'obra', voter_email: 'a@example.com' })
    expect(mocks.set).toHaveBeenCalledWith('gallery-voter', expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'lax' }))
  })
  it('uses authenticated email instead of an arbitrary supplied email', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { email: 'Owner@example.com' } } })
    await likeArtwork('obra', 'other@example.com')
    expect(mocks.rpc).toHaveBeenCalledWith('like_gallery_artwork', { artwork_slug: 'obra', voter_email: 'owner@example.com' })
  })
  it('reuses a remembered identity for subsequent works', async () => {
    mocks.get.mockReturnValue({ value: signGalleryIdentity('a@example.com', 'test-secret') })
    await likeArtwork('otra-obra')
    expect(mocks.rpc).toHaveBeenCalledWith('like_gallery_artwork', { artwork_slug: 'otra-obra', voter_email: 'a@example.com' })
  })
  it('does not claim success or remember an identity when the transaction fails', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'failure' } })
    expect(await likeArtwork('obra', 'a@example.com')).toHaveProperty('error')
    expect(mocks.set).not.toHaveBeenCalled()
  })
})
