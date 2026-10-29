import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Result = { data: unknown; error: { code?: string; message: string } | null }
const mocks = vi.hoisted(() => ({
  user: { value: { id: 'user-1' } as { id: string; email?: string } | null },
  tables: {} as Record<string, { data: unknown; error: { code?: string; message: string } | null }>,
  updates: [] as { table: string; values: unknown }[],
  updateResult: { value: { data: null, error: null } as { data: unknown; error: { code?: string; message: string } | null } },
  rpc: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`)
  },
}))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/public-data-cache', () => ({ refreshClubGallery: mocks.refresh }))
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: async () => mocks.user.value,
  createClient: async () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      const result = (): Result => mocks.tables[table] ?? { data: [], error: null }
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        maybeSingle: async () => result(),
        update: (values: unknown) => {
          mocks.updates.push({ table, values })
          return { eq: async () => mocks.updateResult.value }
        },
        then: (resolve: (value: Result) => unknown) => resolve(result()),
      }
      return chain
    },
  }),
}))
import { saveGallerySettings, saveHangings, unlockItem } from './actions'

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}
const gallery = { id: 'g-1', slug: 'ana-1', template_id: 'cabinet', status: 'active' }
const settings = { title: 'Mi muestra', statement: '', template_id: 'cabinet', theme: 'collage', default_frame_style: 'standard', contact_whatsapp: '', contact_url: '' }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('CLUB_OPEN', 'on')
  mocks.user.value = { id: 'user-1' }
  mocks.updates.length = 0
  mocks.updateResult.value = { data: null, error: null }
  for (const key of Object.keys(mocks.tables)) delete mocks.tables[key]
  mocks.tables.club_galleries = { data: gallery, error: null }
  mocks.tables.user_gallery_inventory = { data: [], error: null }
  mocks.tables.club_gallery_hangings = { data: [], error: null }
  mocks.tables.artworks = { data: [{ id: 'a' }, { id: 'b' }], error: null }
  mocks.rpc.mockResolvedValue({ error: null })
})

afterEach(() => vi.unstubAllEnvs())

describe('who can edit', () => {
  it('keeps everyone but the admins out while the Club is closed', async () => {
    vi.stubEnv('CLUB_OPEN', '')
    mocks.user.value = { id: 'user-1', email: 'someone@example.com' }
    await expect(unlockItem(form({ item: 'theme:museum' }))).rejects.toThrow('REDIRECT:/')
    expect(mocks.rpc).not.toHaveBeenCalled()
    mocks.user.value = { id: 'user-1', email: 'mundialdecollage@gmail.com' }
    await expect(unlockItem(form({ item: 'theme:museum' }))).rejects.toThrow('desbloqueado=1')
  })
  it('sends a visitor without a session to /mi-galeria', async () => {
    mocks.user.value = null
    await expect(unlockItem(form({ item: 'theme:museum' }))).rejects.toThrow('REDIRECT:/mi-galeria')
  })
  it.each([['paused'], ['draft']])('sends a %s gallery back to /mi-galeria', async (status) => {
    mocks.tables.club_galleries = { data: { ...gallery, status }, error: null }
    await expect(saveHangings(form({ 'slot:a': '1' }))).rejects.toThrow('REDIRECT:/mi-galeria')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('unlockItem', () => {
  it('spends the coins on a catalogue item and says it worked', async () => {
    await expect(unlockItem(form({ item: 'theme:museum' }))).rejects.toThrow('REDIRECT:/mi-galeria/editar?desbloqueado=1')
    expect(mocks.rpc).toHaveBeenCalledWith('spend_coins_on_item', { p_item_id: 'theme:museum' })
  })
  it('does not call the database for an item that is not for sale', async () => {
    for (const item of ['theme:collage', 'avatar-accessory:beret', 'room:palace', '']) {
      await expect(unlockItem(form({ item }))).rejects.toThrow('REDIRECT:/mi-galeria/editar?error=invalid')
    }
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('says when there are not enough coins', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Insufficient Club coins' } })
    await expect(unlockItem(form({ item: 'room:double' }))).rejects.toThrow('REDIRECT:/mi-galeria/editar?error=coins')
  })
  it('says unavailable for any other failure', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'connection reset' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(unlockItem(form({ item: 'room:double' }))).rejects.toThrow('REDIRECT:/mi-galeria/editar?error=unavailable')
  })
})

describe('saveHangings', () => {
  it('saves the positions in order and refreshes only that gallery', async () => {
    await expect(saveHangings(form({ 'slot:a': '2', 'slot:b': '1' }))).rejects.toThrow('REDIRECT:/mi-galeria/editar?guardado=1')
    expect(mocks.rpc).toHaveBeenCalledWith('replace_club_gallery_hangings', {
      p_rows: [{ slot: 1, artwork_id: 'b', frame_style: '' }, { slot: 2, artwork_id: 'a', frame_style: '' }],
    })
    expect(mocks.refresh).toHaveBeenCalledWith('ana-1')
  })
  it.each([
    ['two in one position', { 'slot:a': '1', 'slot:b': '1' }],
    ['a position past the 8 of the cabinet', { 'slot:a': '9' }],
    ["someone else's obra", { 'slot:zzz': '1' }],
  ])('refuses %s without touching the gallery', async (_label, fields) => {
    await expect(saveHangings(form(fields))).rejects.toThrow('REDIRECT:/mi-galeria/editar?error=invalid')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it('does not refresh the gallery when the database refuses', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Club item is not unlocked: frame:gold' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(saveHangings(form({ 'slot:a': '1' }))).rejects.toThrow('REDIRECT:/mi-galeria/editar?error=unavailable')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

describe('saveGallerySettings', () => {
  it('updates the gallery and refreshes it', async () => {
    await expect(saveGallerySettings(form(settings))).rejects.toThrow('REDIRECT:/mi-galeria/editar?guardado=1')
    expect(mocks.updates).toEqual([{ table: 'club_galleries', values: expect.objectContaining({ title: 'Mi muestra', theme: 'collage', statement: null }) }])
    expect(mocks.refresh).toHaveBeenCalledWith('ana-1')
  })
  it('refuses a theme that is not unlocked, and accepts it after buying it', async () => {
    await expect(saveGallerySettings(form({ ...settings, theme: 'museum' }))).rejects.toThrow('REDIRECT:/mi-galeria/editar?error=locked')
    expect(mocks.updates).toEqual([])
    mocks.tables.user_gallery_inventory = { data: [{ item_id: 'theme:museum' }], error: null }
    await expect(saveGallerySettings(form({ ...settings, theme: 'museum' }))).rejects.toThrow('guardado=1')
    expect(mocks.updates).toHaveLength(1)
  })
  it('does not shrink the room under obras hung past its last position', async () => {
    mocks.tables.club_galleries = { data: { ...gallery, template_id: 'classic' }, error: null }
    mocks.tables.user_gallery_inventory = { data: [{ item_id: 'room:classic' }], error: null }
    mocks.tables.club_gallery_hangings = { data: [{ slot: 12 }], error: null }
    await expect(saveGallerySettings(form({ ...settings, template_id: 'cabinet' }))).rejects.toThrow('REDIRECT:/mi-galeria/editar?error=room')
    expect(mocks.updates).toEqual([])
  })
  it('maps a refusal of the unlock trigger to the locked answer', async () => {
    mocks.updateResult.value = { data: null, error: { code: 'P0001', message: 'Club item is not unlocked: theme:museum' } }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(saveGallerySettings(form(settings))).rejects.toThrow('REDIRECT:/mi-galeria/editar?error=locked')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
