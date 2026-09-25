import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`) }),
}))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/track-server', () => ({ trackServer: async () => {} }))
import { confirmArtistDetails } from './actions'

function query(data: unknown, error: unknown = null) {
  const chain = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), maybeSingle: vi.fn(async () => ({ data, error })) }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  return chain
}
function details(country = 'AR') {
  const form = new FormData()
  form.set('name', '  Ana Collage  ')
  form.set('country_code', country)
  form.set('artwork_id', 'artwork-1')
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'artist-1' } } })
})

describe('artist confirmation', () => {
  it('requires a current session before accessing artist data', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect(await confirmArtistDetails('', details())).toBe('session')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('validates the country before saving', async () => {
    expect(await confirmArtistDetails('', details('INVALID'))).toBe('missing')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('refuses an artwork that does not belong to this artist', async () => {
    const artwork = query(null)
    mocks.from.mockReturnValue(artwork)
    expect(await confirmArtistDetails('', details())).toBe('not_found')
    expect(artwork.eq).toHaveBeenCalledWith('profile_id', 'artist-1')
    expect(artwork.update).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
  it('confirms repeatedly without inserting or modifying an artwork', async () => {
    const artwork = query({ id: 'artwork-1', slug: 'ana-collage' })
    const profile = query({ id: 'artist-1' })
    mocks.from.mockImplementation(table => table === 'artworks' ? artwork : profile)
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(confirmArtistDetails('', details())).rejects.toThrow('redirect:/onboarding/confirmado')
    }
    expect(profile.update).toHaveBeenCalledWith({ name: 'Ana Collage', country_code: 'AR', details_confirmed_at: expect.any(String) })
    expect(profile.eq).toHaveBeenCalledWith('id', 'artist-1')
    expect(artwork.update).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/obras/ana-collage')
  })
  it('keeps the artist on the confirmation form if saving fails', async () => {
    mocks.from.mockImplementation(table => table === 'artworks' ? query({ id: 'artwork-1' }) : query(null, { message: 'offline' }))
    expect(await confirmArtistDetails('', details())).toBe('save_failed')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
