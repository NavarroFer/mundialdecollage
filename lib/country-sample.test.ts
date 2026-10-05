import { describe, expect, it } from 'vitest'
import { COUNTRY_SAMPLE_SIZE, countryArtworks, randomSample, sampleCountryArtworks } from './country-sample'

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('randomSample', () => {
  it('caps at the sample size without repeating items', () => {
    const sample = randomSample(range(300))
    expect(sample).toHaveLength(COUNTRY_SAMPLE_SIZE)
    expect(new Set(sample).size).toBe(COUNTRY_SAMPLE_SIZE)
  })

  it('returns every item when there are fewer than the size', () => {
    expect(randomSample(range(5)).sort((a, b) => a - b)).toEqual(range(5))
  })

  it('draws according to the random source', () => {
    // Always picking the last remaining slot: each swap parks the displaced
    // item at the end, where the next draw finds it.
    expect(randomSample(range(6), 3, () => 0.999)).toEqual([5, 0, 1])
    expect(randomSample(range(6), 3, () => 0)).toEqual([0, 1, 2])
  })

  it('does not mutate the input', () => {
    const items = range(30)
    randomSample(items)
    expect(items).toEqual(range(30))
  })
})

describe('countryArtworks', () => {
  it('matches country codes case-insensitively', () => {
    const artworks = [{ countryCode: 'ar' }, { countryCode: 'AR' }, { countryCode: 'UY' }]
    expect(countryArtworks(artworks, 'AR')).toHaveLength(2)
    expect(sampleCountryArtworks(artworks, 'UY')).toEqual([{ countryCode: 'UY' }])
  })
})
