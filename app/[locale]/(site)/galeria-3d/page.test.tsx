import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './page'
const mocks = vi.hoisted(() => ({ user: vi.fn(), artworks: vi.fn() }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/lib/gallery-artworks', () => ({ getGalleryArtworks: mocks.artworks }))
vi.mock('@/lib/i18n/server', () => ({ getI18n: async () => ({ locale: 'es' }) }))
vi.mock('@/components/gallery/GalleryAccess', () => ({ GallerySignIn: 'gallery-sign-in', GalleryAccess: 'gallery-access' }))
vi.mock('@/components/stamp-visit', () => ({ StampVisit: 'stamp-visit' }))
beforeEach(() => { vi.clearAllMocks(); mocks.artworks.mockResolvedValue([]) })
describe('gallery access', () => {
  it('only returns the sign-in screen to anonymous visitors, without fetching works', async () => {
    mocks.user.mockResolvedValue(null)
    const result = await Page()
    expect(result.type).toBe('gallery-sign-in')
    expect(mocks.artworks).not.toHaveBeenCalled()
  })
  it('returns the gallery to a verified account', async () => {
    mocks.user.mockResolvedValue({ id: 'user-a' })
    const result = await Page()
    expect(result.props.children[1].props.userId).toBe('user-a')
    expect(mocks.artworks).toHaveBeenCalledWith('es')
  })
})
