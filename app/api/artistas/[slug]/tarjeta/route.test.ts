import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getArtistCard: vi.fn() }))
vi.mock('@/lib/artist-card-data', () => ({ getArtistCard: mocks.getArtistCard }))

import { GET } from './route'

const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const card = { name: 'Ana', countryCode: 'AR', instagram: null, website: null, techniques: ['Collage'], artworks: 2, images: [] }
const call = (slug: string) => GET(new Request(`https://site.test/api/artistas/${slug}/tarjeta`), { params: Promise.resolve({ slug }) } as never)

beforeEach(() => vi.resetAllMocks())

describe('GET /api/artistas/[slug]/tarjeta', () => {
  it('answers the same cached card to everyone', async () => {
    mocks.getArtistCard.mockResolvedValue(card)
    const response = await call(id)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(card)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400')
    expect(mocks.getArtistCard).toHaveBeenCalledWith(id)
  })

  it('also takes the whole profile slug', async () => {
    mocks.getArtistCard.mockResolvedValue(card)
    expect((await call(`ana-${id}`)).status).toBe(200)
    expect(mocks.getArtistCard).toHaveBeenCalledWith(id)
  })

  it('answers 404, remembered only briefly, for an unknown or unpublished artist', async () => {
    mocks.getArtistCard.mockResolvedValue(null)
    const response = await call(id)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toContain('s-maxage=60')
  })

  it('does not even ask the database about something that is not an id', async () => {
    const response = await call('ana-sin-id')
    expect(response.status).toBe(404)
    expect(mocks.getArtistCard).not.toHaveBeenCalled()
  })

  it('does not cache a failure', async () => {
    mocks.getArtistCard.mockRejectedValue(new Error('down'))
    const response = await call(id)
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
