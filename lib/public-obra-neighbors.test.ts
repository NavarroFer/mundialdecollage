import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Finalist } from './finalists'
import { obraNeighbors } from './obra-detail'
const mocks = vi.hoisted(() => ({ index: vi.fn(), work: vi.fn() }))
vi.mock('@/lib/finalists', () => ({ getFinalistIndex: mocks.index, getPublishedFinalistBySlug: mocks.work }))
import { getPublicObraNeighbors } from './public-obra-neighbors'
const listing: Finalist[] = Array.from({ length: 9 }, (_, i) => ({
  slug: `work-${i}`, profileId: i % 2 ? 'other' : 'artist',
  name: `Artist ${i}`, artworkTitle: `Title ${i}`, imageUrl: `/${i}.jpg`, countryCode: 'AR',
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.index.mockResolvedValue(listing.map(({ slug, profileId }) => ({ slug, profileId })))
  mocks.work.mockImplementation(async (slug: string) => listing.find(work => work.slug === slug))
})
describe('scoped public artwork neighbors', () => {
  it('preserves existing navigation/cards and loads only the obras displayed', async () => {
    expect(await getPublicObraNeighbors(listing[2])).toEqual(obraNeighbors(listing, listing[2]))
    const loaded = mocks.work.mock.calls.map(([slug]) => slug)
    expect(new Set(loaded)).toEqual(new Set(['work-0', 'work-4', 'work-6', 'work-1', 'work-3']))
    expect(loaded).toHaveLength(5)
    expect(loaded).not.toContain('work-8')
  })
  it('omits a neighbor hidden since the index was read instead of leaking cached listing data', async () => {
    mocks.work.mockImplementation(async (slug: string) => slug === 'work-1' ? undefined : listing.find(work => work.slug === slug))
    expect((await getPublicObraNeighbors(listing[2])).previous).toBeNull()
  })
  it('keeps navigation empty for unpublished works', async () => {
    const neighbors = await getPublicObraNeighbors({ ...listing[0], slug: 'private', profileId: 'private-artist' })
    expect(neighbors).toEqual({ related: [], previous: null, next: null })
    expect(mocks.work).not.toHaveBeenCalled()
  })
})
