import { describe, expect, it } from 'vitest'
import { COUNTRY_PAGE_SIZE, countryArtworks, countryPage, paginate } from './country-pages'

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('paginate', () => {
  it('splits into pages of the page size, in order', () => {
    const first = paginate(range(45), 0)
    expect(first.items).toEqual(range(COUNTRY_PAGE_SIZE))
    expect(first).toMatchObject({ page: 0, pageCount: 3, total: 45, from: 1, to: 20 })

    const last = paginate(range(45), 2)
    expect(last.items).toEqual([40, 41, 42, 43, 44])
    expect(last).toMatchObject({ page: 2, from: 41, to: 45 })
  })

  it('returns the same items for the same page every time', () => {
    expect(paginate(range(300), 4).items).toEqual(paginate(range(300), 4).items)
  })

  it('keeps everything on one page when it fits', () => {
    expect(paginate(range(5), 0)).toMatchObject({ items: range(5), pageCount: 1, from: 1, to: 5 })
    expect(paginate(range(20), 0).pageCount).toBe(1)
  })

  it('clamps out-of-range pages', () => {
    expect(paginate(range(45), 9).page).toBe(2)
    expect(paginate(range(45), -1).page).toBe(0)
    expect(paginate(range(45), Number.NaN).page).toBe(0)
  })

  it('reports an empty list as one empty page', () => {
    expect(paginate([], 0)).toEqual({ items: [], page: 0, pageCount: 1, total: 0, from: 0, to: 0 })
  })
})

describe('countryArtworks', () => {
  it('matches country codes case-insensitively', () => {
    const artworks = [{ countryCode: 'ar' }, { countryCode: 'AR' }, { countryCode: 'UY' }]
    expect(countryArtworks(artworks, 'AR')).toHaveLength(2)
    expect(countryPage(artworks, 'UY', 0).items).toEqual([{ countryCode: 'UY' }])
  })
})
