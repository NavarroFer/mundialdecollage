import { describe, expect, it } from 'vitest'
import type { ClubHouse } from './club-map'
import { pickNextGallery } from './club-next-gallery'

const gallery = (slug: string): ClubHouse => ({ slug, title: slug, artistName: slug, countryCode: 'AR', coordinates: null, obras: 1 })
const all = ['a', 'b', 'c', 'd'].map(gallery)

describe('pickNextGallery', () => {
  it('never leads back to the gallery the visitor is in', () => {
    for (const roll of [0, 0.3, 0.6, 0.99]) expect(pickNextGallery(all, 'a', new Set(), () => roll)?.slug).not.toBe('a')
  })
  it('prefers galleries this browser has not been to', () => {
    expect(pickNextGallery(all, 'a', new Set(['b', 'c']), () => 0.99)?.slug).toBe('d')
  })
  it('starts over once every other gallery was visited', () => {
    expect(pickNextGallery(all, 'a', new Set(['a', 'b', 'c', 'd']), () => 0)?.slug).toBe('b')
  })
  it('has nowhere to lead when the Club has a single gallery', () => {
    expect(pickNextGallery([gallery('a')], 'a', new Set())).toBeNull()
  })
})
