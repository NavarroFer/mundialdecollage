import { describe, expect, it } from 'vitest'
import type { Finalist } from './finalists'
import { obraNeighbors } from './obra-detail'

const obra = (slug: string, profileId: string): Finalist => ({
  slug,
  profileId,
  name: `Artista ${profileId}`,
  countryCode: 'AR',
  artworkTitle: slug,
  imageUrl: `https://example.com/${slug}.jpg`,
  technique: 'Mixta',
  instagram: 'https://instagram.com/x',
})

describe('obraNeighbors', () => {
  const listing = [obra('a', '1'), obra('b', '2'), obra('c', '1'), obra('d', '1'), obra('e', '1'), obra('f', '1')]

  it('offers up to three more obras by the same artist, never the obra itself', () => {
    expect(obraNeighbors(listing, listing[0]).related.map(({ slug }) => slug)).toEqual(['c', 'd', 'e'])
    expect(obraNeighbors(listing, listing[1]).related).toEqual([])
  })

  it('links the obras before and after it in the listing', () => {
    const { previous, next } = obraNeighbors(listing, listing[1])
    expect(previous?.slug).toBe('a')
    expect(next?.slug).toBe('c')
    expect(obraNeighbors(listing, listing[0]).previous).toBeNull()
    expect(obraNeighbors(listing, listing[5]).next).toBeNull()
  })

  it('sends only what a card draws', () => {
    expect(obraNeighbors(listing, listing[1]).next).toEqual({
      slug: 'c',
      artworkTitle: 'c',
      name: 'Artista 1',
      countryCode: 'AR',
      imageUrl: 'https://example.com/c.jpg',
    })
  })

  it('has no neighbors for an obra missing from the listing', () => {
    const { previous, next } = obraNeighbors(listing, obra('z', '9'))
    expect(previous).toBeNull()
    expect(next).toBeNull()
  })
})
