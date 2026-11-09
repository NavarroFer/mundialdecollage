import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  from: vi.fn(),
  adminFrom: vi.fn(),
  revalidatePath: vi.fn(),
  refreshPublicData: vi.fn(),
  refreshArtworkData: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`) }),
}))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: mocks.from }), getCurrentUser: mocks.user }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.adminFrom }) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/public-data-cache', () => ({ refreshPublicData: mocks.refreshPublicData, refreshArtworkData: mocks.refreshArtworkData }))
import { saveProfile } from './actions'

// A chain that answers whatever is awaited or .maybeSingle()'d with `result`.
function chain(result: { data?: unknown; error?: unknown }) {
  const value = { data: null, error: null, ...result }
  const c: Record<string, unknown> = {}
  for (const method of ['select', 'update', 'eq']) c[method] = vi.fn(() => c)
  c.maybeSingle = vi.fn(async () => value)
  c.then = (resolve: (v: unknown) => unknown) => resolve(value)
  return c as Record<'select' | 'update' | 'eq' | 'maybeSingle', ReturnType<typeof vi.fn>>
}

const ARTWORKS = [
  { id: 'a1', slug: 'ana-raices', title: 'Raíces', technique: null },
  { id: 'a2', slug: 'ana-mar', title: 'Mar', technique: 'Mixta' },
]

function form(overrides: Record<string, string | string[]> = {}) {
  const values: Record<string, string | string[]> = {
    name: '  Ana   Pérez ', country_code: 'ar', instagram: '@ana.collage', website: 'anacollage.com',
    artwork_id: ['a1', 'a2'], artwork_title: ['Raíces', 'Mar'], technique: ['', 'Mixta'], ...overrides,
  }
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) for (const item of [value].flat()) data.append(key, item)
  return data
}

let profiles: ReturnType<typeof chain>
let artworks: ReturnType<typeof chain>
let adminArtworks: ReturnType<typeof chain>
let adminContacts: ReturnType<typeof chain>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user.mockResolvedValue({ id: 'artist-1', email: 'Ana@Example.com' })
  profiles = chain({ data: { id: 'artist-1', name: 'Ana Perez', country_code: 'AR' } })
  artworks = chain({ data: ARTWORKS })
  adminArtworks = chain({})
  adminContacts = chain({})
  mocks.from.mockImplementation((table: string) => (table === 'profiles' ? profiles : artworks))
  mocks.adminFrom.mockImplementation((table: string) => (table === 'contacts' ? adminContacts : adminArtworks))
})

const saves = async (data: FormData) => (await saveProfile(data).catch((error: Error) => error.message)) as string

describe('saveProfile', () => {
  it('needs a session', async () => {
    mocks.user.mockResolvedValue(null)
    expect(await saves(form())).toBe('redirect:/onboarding')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('saves the profile with their own session, and the email is not part of it', async () => {
    expect(await saves(form())).toBe('redirect:/mi-perfil?guardado=1')
    expect(profiles.update).toHaveBeenCalledWith({
      name: 'Ana Pérez', country_code: 'AR', instagram: 'https://instagram.com/ana.collage', website: 'https://anacollage.com/',
    })
    expect(profiles.eq).toHaveBeenCalledWith('id', 'artist-1')
  })

  it('writes only the obras that changed, scoped to their owner', async () => {
    expect(await saves(form({ artwork_title: ['Raíces nuevas', 'Mar'], technique: ['Digital', 'Mixta'] }))).toBe('redirect:/mi-perfil?guardado=1')
    expect(adminArtworks.update).toHaveBeenCalledTimes(1)
    expect(adminArtworks.update).toHaveBeenCalledWith({ title: 'Raíces nuevas', technique: 'Digital' })
    expect(adminArtworks.eq).toHaveBeenCalledWith('id', 'a1')
    expect(adminArtworks.eq).toHaveBeenCalledWith('profile_id', 'artist-1')
  })

  it('fixes the name in the mailing list too', async () => {
    await saves(form())
    expect(adminContacts.update).toHaveBeenCalledWith({ name: 'Ana Pérez' })
    expect(adminContacts.eq).toHaveBeenCalledWith('email', 'ana@example.com')
  })

  it('leaves the mailing list alone when the name did not change', async () => {
    profiles = chain({ data: { id: 'artist-1', name: 'Ana Pérez', country_code: 'AR' } })
    await saves(form())
    expect(adminContacts.update).not.toHaveBeenCalled()
  })

  it('refuses an obra that is not theirs', async () => {
    expect(await saves(form({ artwork_id: ['a1', 'someone-elses'] }))).toBe('redirect:/mi-perfil?error=save_failed')
    expect(profiles.update).not.toHaveBeenCalled()
    expect(adminArtworks.update).not.toHaveBeenCalled()
  })

  it.each([
    ['a missing name', { name: '   ' }, 'missing_fields'],
    ['an unknown country', { country_code: 'XX' }, 'missing_fields'],
    ['a bad Instagram', { instagram: 'not a handle!!' }, 'invalid_instagram'],
    ['a javascript: website', { website: 'javascript:alert(1)' }, 'invalid_website'],
    ['an empty title', { artwork_title: ['', 'Mar'] }, 'missing_title'],
    ['an unknown technique', { technique: ['Óleo', 'Mixta'] }, 'save_failed'],
  ])('rejects %s before saving anything', async (_label, overrides, code) => {
    expect(await saves(form(overrides))).toBe(`redirect:/mi-perfil?error=${code}`)
    expect(profiles.update).not.toHaveBeenCalled()
    expect(adminArtworks.update).not.toHaveBeenCalled()
  })

  it('clears the links when they are emptied', async () => {
    await saves(form({ instagram: '', website: '' }))
    expect(profiles.update).toHaveBeenCalledWith(expect.objectContaining({ instagram: null, website: null }))
  })

  it('refreshes the whole public data only when the country changed', async () => {
    await saves(form())
    expect(mocks.refreshPublicData).not.toHaveBeenCalled()
    expect(mocks.refreshArtworkData).toHaveBeenCalled()
    await saves(form({ country_code: 'UY' }))
    expect(mocks.refreshPublicData).toHaveBeenCalled()
  })
})
