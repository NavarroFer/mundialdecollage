import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), from: vi.fn(), list: vi.fn(), remove: vi.fn() }))
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
    storage: {
      from: () => ({
        list: mocks.list,
        remove: mocks.remove,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/wall/${path}` } }),
      }),
    },
  }),
}))
import { placeWallPiece } from './wall-actions'

const id = '11111111-2222-3333-4444-555555555555'
const file = '99999999-8888-7777-6666-555555555555.jpg'
const user = { id, email: 'Ana@Example.com', user_metadata: { full_name: 'Ana Pérez' } }
const placed = (row: Record<string, unknown>) => ({ single: vi.fn(async () => ({ data: row, error: null })) })

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret')
  mocks.getUser.mockResolvedValue({ data: { user } })
  mocks.list.mockResolvedValue({ data: [{ name: file }], error: null })
  mocks.remove.mockResolvedValue({ error: null })
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'upsert']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  mocks.from.mockReturnValue(chain)
})

describe('placeWallPiece', () => {
  it('asks to sign in first', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect(await placeWallPiece({ path: `${id}/${file}`, x: 0.5, y: 0.5 })).toEqual({ error: 'sign_in_required' })
  })

  it("refuses a photo in someone else's folder, or a spot off the frame", async () => {
    expect(await placeWallPiece({ path: `aaaaaaaa-2222-3333-4444-555555555555/${file}`, x: 0.5, y: 0.5 })).toEqual({ error: 'invalid' })
    expect(await placeWallPiece({ path: `${id}/${file}`, x: 1.5, y: 0.5 })).toEqual({ error: 'invalid' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('pastes it as pending, signed with the visitor name, and returns the lives left', async () => {
    mocks.rpc.mockReturnValue(placed({ status: 'placed', piece_id: 'p1', piece_rotation: 0.05, lives: 2, next_life_at: '2026-10-02T20:00:00Z' }))
    const result = await placeWallPiece({ path: `${id}/${file}`, x: 0.25, y: 0.75 })
    expect(mocks.rpc).toHaveBeenCalledWith('place_wall_piece', expect.objectContaining({ visitor: id, visitor_name: 'Ana Pérez', at_x: 0.25, at_y: 0.75, unlimited: false }))
    expect(result).toEqual({
      piece: { id: 'p1', url: `https://cdn.test/wall/${id}/${file}`, x: 0.25, y: 0.75, rotation: 0.05, cutout: false, pending: true },
      lives: { lives: 2, nextLifeAt: '2026-10-02T20:00:00Z', unlimited: false },
    })
  })

  it('pastes a transparent PNG or WebP as a cutout', async () => {
    const cutout = file.replace('.jpg', '.webp')
    mocks.list.mockResolvedValue({ data: [{ name: cutout }], error: null })
    mocks.rpc.mockReturnValue(placed({ status: 'placed', piece_id: 'p2', piece_rotation: 0, lives: 2, next_life_at: null }))
    const result = await placeWallPiece({ path: `${id}/${cutout}`, x: 0.5, y: 0.5 })
    expect(result).toMatchObject({ piece: { id: 'p2', cutout: true } })
  })

  it("puts an admin's piece up already approved, with no limit", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...user, email: 'mundialdecollage@gmail.com' } } })
    mocks.rpc.mockReturnValue(placed({ status: 'placed', piece_id: 'p3', piece_rotation: 0, lives: 0, next_life_at: null }))
    const result = await placeWallPiece({ path: `${id}/${file}`, x: 0.5, y: 0.5 })
    expect(mocks.rpc).toHaveBeenCalledWith('place_wall_piece', expect.objectContaining({ unlimited: true }))
    expect(result).toMatchObject({ piece: { id: 'p3', pending: false }, lives: { unlimited: true } })
  })

  it('deletes the uploaded photo when there are no lives left', async () => {
    mocks.rpc.mockReturnValue(placed({ status: 'no_lives', piece_id: null, piece_rotation: null, lives: 0, next_life_at: '2026-10-02T20:00:00Z' }))
    const result = await placeWallPiece({ path: `${id}/${file}`, x: 0.5, y: 0.5 })
    expect(result).toEqual({ error: 'no_lives', lives: { lives: 0, nextLifeAt: '2026-10-02T20:00:00Z', unlimited: false } })
    expect(mocks.remove).toHaveBeenCalledWith([`${id}/${file}`])
  })

  it('refuses a photo that never reached Storage', async () => {
    mocks.list.mockResolvedValue({ data: [], error: null })
    expect(await placeWallPiece({ path: `${id}/${file}`, x: 0.5, y: 0.5 })).toEqual({ error: 'upload_failed' })
  })
})
