import { describe, expect, it } from 'vitest'
import { buildArtistCountryStats, buildArtworkStats, formatShare, type StatsArtwork } from './artwork-stats'

describe('buildArtworkStats', () => {
  it('includes missing techniques in the denominator and separates publication status', () => {
    const stats = buildArtworkStats([
      { technique: 'Analógica', profiles: { id: 'p1', is_public: true, country_code: 'AR' } },
      { technique: 'Digital', profiles: { id: 'p2', is_public: false, country_code: 'AR' } },
      { technique: null, profiles: { id: 'p3', is_public: null, country_code: 'AR' } },
      { technique: ' ', profiles: { id: 'p4', is_public: true, country_code: 'AR' } },
    ])
    expect(stats).toMatchObject({ total: 4, published: 2, pending: 2, withTechnique: 2 })
    expect(stats.techniques.find(t => t.label === 'Sin técnica registrada')?.count).toBe(2)
    expect(stats.techniques.reduce((sum, t) => sum + t.count, 0)).toBe(stats.total)
  })
  it('handles empty data without invalid percentages', () => {
    expect(buildArtworkStats([])).toMatchObject({ total: 0, published: 0, withTechnique: 0 })
    expect(formatShare(0, 0)).toBe('0%')
  })
  it('keeps small shares visible with a decimal', () => {
    expect(formatShare(1, 218)).toBe('0,5%')
  })
})

const artwork = (id: string, country_code: string | null): StatsArtwork => ({
  technique: 'Mixta',
  profiles: { id, is_public: true, country_code },
})

describe('buildArtistCountryStats', () => {
  it('counts each artist once, even with several selected obras', () => {
    const stats = buildArtistCountryStats([artwork('a', 'AR'), artwork('a', 'AR'), artwork('b', 'AU'), artwork('c', 'AR')])
    expect(stats).toEqual({
      totalArtists: 3,
      withCountry: 3,
      countries: [
        { countryCode: 'AR', count: 2 },
        { countryCode: 'AU', count: 1 },
      ],
    })
  })

  it('keeps artists without a country in the total, listed last', () => {
    const stats = buildArtistCountryStats([artwork('a', null), artwork('b', null), artwork('c', 'MT')])
    expect(stats.totalArtists).toBe(3)
    expect(stats.withCountry).toBe(1)
    expect(stats.countries.at(-1)).toEqual({ countryCode: null, count: 2 })
  })
})
