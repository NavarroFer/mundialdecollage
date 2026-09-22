import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Finalist } from '@/lib/finalists'

vi.mock('@/lib/finalists', () => ({
  getFinalists: vi.fn(),
  countryCodeToName: () => 'Argentina',
}))

import { getFinalists } from '@/lib/finalists'
import { getDailyExhibition, getGalleryArtworks } from './gallery-artworks'

const finalists: Finalist[] = Array.from({ length: 40 }, (_, index) => ({
  slug: `obra-${index}`, name: `Artista ${index}`, countryCode: 'AR',
  artworkTitle: `Obra ${index}`, imageUrl: `/obra-${index}.jpg`,
}))

afterEach(() => vi.useRealTimers())

describe('daily exhibition shared by home and 3D gallery', () => {
  it('selects the same 20 works in the same order regardless of query ordering', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-22T12:00:00Z'))
    vi.mocked(getFinalists).mockResolvedValueOnce(finalists)
      .mockResolvedValueOnce([...finalists].reverse())
    const home = await getDailyExhibition()
    const gallery = await getGalleryArtworks()
    expect(home).toHaveLength(20)
    expect(new Set(home.map(work => work.slug)).size).toBe(20)
    expect(gallery.map(work => work.id)).toEqual(home.map(work => work.slug))
  })

  it('rotates at the UTC day boundary and handles fewer available works', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-22T23:59:59Z'))
    vi.mocked(getFinalists).mockResolvedValue(finalists)
    const today = await getDailyExhibition()
    vi.setSystemTime(new Date('2026-09-23T00:00:00Z'))
    expect(await getDailyExhibition()).not.toEqual(today)
    vi.mocked(getFinalists).mockResolvedValue(finalists.slice(0, 3))
    expect(await getGalleryArtworks()).toHaveLength(3)
    vi.mocked(getFinalists).mockResolvedValue([])
    expect(await getGalleryArtworks()).toEqual([])
  })
})
