import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildArtistCard, loadArtistCard, resetArtistCards, topTechniques, type ArtistCardRow } from '@/lib/artist-card'

const profile = { name: 'Ana', country_code: 'AR', instagram: '@ana.collage', website: 'https://ana.example' }
const row = (over: Partial<ArtistCardRow> = {}): ArtistCardRow => ({ slug: 'una', technique: 'Collage analógico', image_url: 'https://x.invalid/una.jpg', profiles: profile, ...over })

describe('topTechniques', () => {
  it('orders by how often they appear, ignoring case and spacing', () => {
    expect(topTechniques(['Collage', 'collage ', 'Fotomontaje', null, '  ', 'Collage', 'Acuarela'])).toEqual(['Collage', 'Fotomontaje', 'Acuarela'])
  })

  it('keeps the order the obras came in when counts tie, and stops at the limit', () => {
    expect(topTechniques(['A', 'B', 'C', 'D'], 2)).toEqual(['A', 'B'])
  })
})

describe('buildArtistCard', () => {
  it('shows what the public profile shows and nothing else', () => {
    const card = buildArtistCard([row(), row({ slug: 'dos', technique: 'Collage analógico', image_url: 'https://x.invalid/dos.jpg' }), row({ slug: 'tres', technique: null }), row({ slug: 'cuatro' })])
    expect(card).toEqual({
      name: 'Ana',
      countryCode: 'AR',
      instagram: 'ana.collage',
      website: 'https://ana.example/',
      techniques: ['Collage analógico'],
      artworks: 4,
      images: ['https://x.invalid/una.jpg', 'https://x.invalid/dos.jpg', 'https://x.invalid/una.jpg'],
    })
  })

  it('has no card without a name, a country or an obra with a photo', () => {
    expect(buildArtistCard([])).toBeUndefined()
    expect(buildArtistCard([row({ profiles: { ...profile, name: null } })])).toBeUndefined()
    expect(buildArtistCard([row({ profiles: { ...profile, country_code: null } })])).toBeUndefined()
    expect(buildArtistCard([row({ image_url: null }), row({ slug: null })])).toBeUndefined()
  })

  it('drops a website that is not http(s) and an instagram that is not a handle', () => {
    const card = buildArtistCard([row({ profiles: { ...profile, website: 'javascript:alert(1)', instagram: 'no es un usuario' } })])
    expect(card?.website).toBeNull()
    expect(card?.instagram).toBeNull()
  })
})

describe('loadArtistCard', () => {
  const ok = { name: 'Ana', countryCode: 'AR', instagram: null, website: null, techniques: [], artworks: 1, images: [] }
  beforeEach(() => resetArtistCards())

  it('asks once per artist, however many times it is called', async () => {
    const fetcher = vi.fn(async () => Response.json(ok)) as unknown as typeof fetch
    const [a, b] = await Promise.all([loadArtistCard('id-1', fetcher), loadArtistCard('id-1', fetcher)])
    await loadArtistCard('id-1', fetcher)
    expect(a).toEqual(ok)
    expect(b).toEqual(ok)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith('/api/artistas/id-1/tarjeta')
    await loadArtistCard('id-2', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('remembers that a profile is not public, but retries after a failure', async () => {
    const missing = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch
    expect(await loadArtistCard('gone', missing)).toBeNull()
    expect(await loadArtistCard('gone', missing)).toBeNull()
    expect(missing).toHaveBeenCalledTimes(1)

    const flaky = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(ok)) as unknown as typeof fetch
    await expect(loadArtistCard('flaky', flaky)).rejects.toThrow()
    expect(await loadArtistCard('flaky', flaky)).toEqual(ok)
    expect(flaky).toHaveBeenCalledTimes(2)
  })
})
