import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Finalist } from '@/lib/finalists'

const supabase = vi.hoisted(() => ({ configured: false, rpc: vi.fn() }))

vi.mock('@/lib/finalists', () => ({
  getFinalists: vi.fn(),
  getFinalistsByIds: vi.fn(),
  countryCodeToName: () => 'Argentina',
}))
vi.mock('@/lib/supabase/config', () => ({
  get isSupabaseConfigured() { return supabase.configured },
}))
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({ rpc: supabase.rpc }),
}))

import { getFinalists, getFinalistsByIds } from '@/lib/finalists'
import { getDailyExhibition, getGalleryArtworks } from './gallery-artworks'

const finalists: Finalist[] = Array.from({ length: 40 }, (_, index) => ({
  slug: `obra-${index}`, name: `Artista ${index}`, countryCode: 'AR',
  artworkTitle: `Obra ${index}`, imageUrl: `/obra-${index}.jpg`,
}))

afterEach(() => {
  vi.useRealTimers()
  supabase.configured = false
  vi.clearAllMocks()
})

describe('stored exhibition (no repeats)', () => {
  it('shows the stored lineup in wall order, skipping obras no longer public', async () => {
    supabase.configured = true
    supabase.rpc.mockResolvedValue({
      data: [{ slot: 0, artwork_id: 'id-7' }, { slot: 1, artwork_id: 'id-gone' }, { slot: 2, artwork_id: 'id-3' }],
      error: null,
    })
    vi.mocked(getFinalistsByIds).mockResolvedValue(new Map([['id-3', finalists[3]], ['id-7', finalists[7]]]))
    expect((await getDailyExhibition()).map(work => work.slug)).toEqual(['obra-7', 'obra-3'])
    expect(supabase.rpc).toHaveBeenCalledWith('ensure_exhibition_today')
    expect(getFinalists).not.toHaveBeenCalled()
  })

  it('falls back to the daily shuffle while the table is not deployed', async () => {
    supabase.configured = true
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'function not found' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(getFinalists).mockResolvedValue(finalists)
    expect(await getDailyExhibition()).toHaveLength(20)
  })
})

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
    // A real SVG flag, not an emoji that Windows shows as bare letters.
    expect(gallery[0].flagSvg).toMatch(/^<svg /)
  })

  it('rotates at 09:00 Argentina and handles fewer available works', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-23T08:59:59-03:00'))
    vi.mocked(getFinalists).mockResolvedValue(finalists)
    const today = await getDailyExhibition()
    // Argentine midnight no longer rotates…
    vi.setSystemTime(new Date('2026-09-23T00:00:00-03:00'))
    expect(await getDailyExhibition()).toEqual(today)
    // …09:00 Argentina does.
    vi.setSystemTime(new Date('2026-09-23T09:00:00-03:00'))
    expect(await getDailyExhibition()).not.toEqual(today)
    vi.mocked(getFinalists).mockResolvedValue(finalists.slice(0, 3))
    expect(await getGalleryArtworks()).toHaveLength(3)
    vi.mocked(getFinalists).mockResolvedValue([])
    expect(await getGalleryArtworks()).toEqual([])
  })
})
