import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), adminFrom: vi.fn(), revalidatePath: vi.fn(), refresh: vi.fn(), refreshArtwork: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.adminFrom, storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example/${path}` } }) }) } }) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/public-data-cache', () => ({ refreshPublicData: mocks.refresh, refreshArtworkData: mocks.refreshArtwork }))
import { deleteSubmissions, getAdminSubmissionDetails, setSubmissionsVisibility, updateArtwork, updateSubmissionTitle, setSubmissionsTechnique } from './actions'

function query(data: unknown, error: { message: string } | null = null) {
  const chain = {
    select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), in: vi.fn(), is: vi.fn(), update: vi.fn(), delete: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  }
  for (const method of ['select', 'eq', 'maybeSingle', 'in', 'is', 'update', 'delete'] as const) chain[method].mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { email: 'mundialdecollage@gmail.com' } } })
})

describe('Admin Obras visibility', () => {
  it('resolves selected artwork IDs to their profile IDs before updating visibility', async () => {
    const artworks = query([{ id: 'work-1', profile_id: 'artist-1' }, { id: 'work-2', profile_id: 'artist-1' }])
    const profiles = query([{ id: 'artist-1' }])
    mocks.from.mockImplementation(table => table === 'artworks' ? artworks : profiles)
    expect(await setSubmissionsVisibility(['work-1', 'work-2'], false)).toEqual({ skipped: [] })
    expect(artworks.in).toHaveBeenCalledWith('id', ['work-1', 'work-2'])
    expect(profiles.in).toHaveBeenCalledWith('id', ['artist-1'])
    expect(profiles.update).toHaveBeenCalledWith({ is_public: false })
  })
  it('reports a database failure instead of returning successful publication', async () => {
    mocks.from.mockImplementation(table => table === 'artworks'
      ? query([{ id: 'work-1', profile_id: 'artist-1' }]) : query(null, { message: 'database unavailable' }))
    await expect(setSubmissionsVisibility(['work-1'], true)).rejects.toThrow('database unavailable')
  })
  it('refuses a disappeared artwork instead of silently updating zero profiles', async () => {
    mocks.from.mockReturnValue(query([]))
    await expect(setSubmissionsVisibility(['missing'], true)).rejects.toThrow('ya no está disponible')
  })
  it('checks admin authorization before looking up details or changing visibility', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { email: 'artist@example.com' } } })
    await expect(setSubmissionsVisibility(['work-1'], true)).rejects.toThrow('Not authorized')
    await expect(getAdminSubmissionDetails('work-1')).rejects.toThrow('Not authorized')
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('Admin Obras bulk deletion', () => {
  it('reports a failed delete and refreshes after a mixed partial result', async () => {
    mocks.from.mockImplementation(table => table === 'artworks' ? query(null, { message: 'delete failed' }) : query([]))
    await expect(deleteSubmissions([{ table: 'artworks', id: 'a' }, { table: 'legacy_submissions', id: 'b' }])).rejects.toThrow('delete failed')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/obras')
  })
})


describe('scoped artwork edits', () => {
  const affected = { slug: 'obra-uno', profile_id: 'artist-one' }

  it('expires only affected identities after a title edit', async () => {
    mocks.adminFrom.mockReturnValue(query([affected]))
    expect(await updateSubmissionTitle('work-1', 'Nuevo título')).toEqual({})
    expect(mocks.refreshArtwork).toHaveBeenCalledWith([affected])
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith('/admin/obras')
  })

  it('resolves a legacy title edit to the linked public artwork', async () => {
    const linked = query([affected])
    mocks.adminFrom.mockImplementation(table => table === 'legacy_submissions' ? query({ id: 'legacy-one' }) : linked)
    expect(await updateSubmissionTitle('legacy-legacy-one', 'Título')).toEqual({})
    expect(linked.eq).toHaveBeenCalledWith('legacy_submission_id', 'legacy-one')
    expect(mocks.refreshArtwork).toHaveBeenCalledWith([affected])
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('expires successful technique edits even when another source fails', async () => {
    mocks.adminFrom.mockReturnValueOnce(query([affected]))
      .mockReturnValueOnce(query(null, { message: 'legacy failed' })).mockReturnValueOnce(query([]))
    await expect(setSubmissionsTechnique(['work-1', 'legacy-one'], 'Mixta')).rejects.toThrow('legacy failed')
    expect(mocks.refreshArtwork).toHaveBeenCalledWith([affected])
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('keeps catalog membership cached when replacing an existing photo', async () => {
    mocks.adminFrom.mockReturnValueOnce(query({ image_url: 'old.jpg' })).mockReturnValueOnce(query(affected))
    expect(await updateArtwork({ artworkId: 'work-1', title: 'Título', technique: 'Mixta', imagePath: 'admin/work-1/123.jpg' })).toEqual({})
    expect(mocks.refreshArtwork).toHaveBeenCalledWith([affected])
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('refreshes membership too when adding the first photo', async () => {
    mocks.adminFrom.mockReturnValueOnce(query({ image_url: null })).mockReturnValueOnce(query(affected))
    await updateArtwork({ artworkId: 'work-1', title: 'Título', technique: 'Mixta', imagePath: 'admin/work-1/123.jpg' })
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.refreshArtwork).not.toHaveBeenCalled()
  })

  it('does not invalidate a failed artwork update', async () => {
    mocks.adminFrom.mockReturnValue(query(null, { message: 'write failed' }))
    expect(await updateArtwork({ artworkId: 'work-1', title: 'Título', technique: 'Mixta' })).toEqual({ error: 'write failed' })
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.refreshArtwork).not.toHaveBeenCalled()
  })
})
