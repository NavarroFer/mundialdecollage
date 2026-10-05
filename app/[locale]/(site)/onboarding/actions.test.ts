import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`) }),
  adminFrom: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
}))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc, storage: { from: mocks.storageFrom } }) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/track-server', () => ({ trackServer: async () => {} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.adminFrom }) }))
import { completeOnboarding, confirmArtistDetails } from './actions'

function query(data: unknown, error: unknown = null) {
  const chain = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), maybeSingle: vi.fn(async () => ({ data, error })) }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  return chain
}
function details(country = 'AR', title = ' Raíces ') {
  const form = new FormData()
  form.set('title', title)
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
    const artwork = query({ id: 'artwork-1', slug: 'ana-collage', title: 'Raíces' })
    const profile = query({ id: 'artist-1' })
    mocks.from.mockImplementation(table => table === 'artworks' ? artwork : profile)
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(confirmArtistDetails('', details())).rejects.toThrow('redirect:/onboarding/confirmado')
    }
    expect(profile.update).toHaveBeenCalledWith({ name: 'Ana Collage', country_code: 'AR', details_confirmed_at: expect.any(String) })
    expect(profile.eq).toHaveBeenCalledWith('id', 'artist-1')
    expect(artwork.update).not.toHaveBeenCalled()
    expect(mocks.adminFrom).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/obras/ana-collage')
  })
  it('asks for the title before saving anything', async () => {
    expect(await confirmArtistDetails('', details('AR', '   '))).toBe('missing_title')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('saves the title an obra without one gets from its artist', async () => {
    const artwork = query({ id: 'artwork-1', slug: 'ana-collage', title: null })
    const adminArtwork = query(null)
    mocks.from.mockImplementation(table => table === 'artworks' ? artwork : query({ id: 'artist-1' }))
    mocks.adminFrom.mockReturnValue(adminArtwork)
    await expect(confirmArtistDetails('', details())).rejects.toThrow('redirect:/onboarding/confirmado')
    expect(mocks.adminFrom).toHaveBeenCalledWith('artworks')
    expect(adminArtwork.update).toHaveBeenCalledWith({ title: 'Raíces' })
    expect(adminArtwork.eq).toHaveBeenCalledWith('profile_id', 'artist-1')
  })
  it('keeps the artist on the confirmation form if saving fails', async () => {
    mocks.from.mockImplementation(table => table === 'artworks' ? query({ id: 'artwork-1', title: 'Raíces' }) : query(null, { message: 'offline' }))
    expect(await confirmArtistDetails('', details())).toBe('save_failed')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})

describe('sending several obras at once', () => {
  function submission(titles: string[], another = false) {
    const form = new FormData()
    form.set('name', 'Ana Collage')
    form.set('country_code', 'AR')
    if (another) form.set('another', '1')
    titles.forEach((title, index) => {
      form.append('artwork_title', title)
      form.append('technique', index === 0 ? 'Digital' : '')
      form.append('artwork_image_path', `artist-1/${index}.jpg`)
    })
    return form
  }

  function tables(existingArtworks: number, onboarded = false) {
    const inserted: Record<string, unknown>[] = []
    const count = { select: vi.fn(), eq: vi.fn(), is: vi.fn() }
    count.select.mockReturnValue(count)
    count.eq.mockReturnValue(count)
    count.is.mockImplementation(() => Object.assign(Promise.resolve({ count: existingArtworks }), count))
    const artworks = {
      ...count,
      insert: vi.fn(async (row: Record<string, unknown>) => { inserted.push(row); return { error: null } }),
    }
    const profiles = { ...query({ onboarded_at: onboarded ? '2026-09-01' : null }), upsert: vi.fn(async () => ({ error: null })) }
    const legacy = { update: vi.fn(), eq: vi.fn(), is: vi.fn(async () => ({ error: null })) }
    legacy.update.mockReturnValue(legacy)
    legacy.eq.mockReturnValue(legacy)
    mocks.from.mockImplementation((table: string) =>
      table === 'artworks' ? artworks : table === 'profiles' ? profiles : legacy,
    )
    mocks.rpc.mockResolvedValue({ data: false })
    mocks.storageFrom.mockReturnValue({
      list: vi.fn(async (_folder: string, { search }: { search: string }) => ({ data: [{ name: search }] })),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage/${path}` } }),
    })
    return inserted
  }

  it('saves every obra and asks a new artist to choose which takes part', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'artist-1', email: 'ana@example.com' } } })
    const inserted = tables(0)
    await expect(completeOnboarding(submission(['Raíces', 'Mar']))).rejects.toThrow('redirect:/onboarding/obras')
    expect(inserted.map((row) => [row.title, row.is_selected, row.technique])).toEqual([
      ['Raíces', true, 'Digital'],
      ['Mar', false, null],
    ])
  })

  it('refuses more obras than one account can keep', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'artist-1', email: 'ana@example.com' } } })
    const inserted = tables(9, true)
    await expect(completeOnboarding(submission(['Uno', 'Dos'], true))).rejects.toThrow(
      'redirect:/onboarding?another=1&error=too_many_artworks',
    )
    expect(inserted).toEqual([])
  })
})
