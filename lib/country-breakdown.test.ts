import { describe, expect, it } from 'vitest'
import { countByCountry } from './country-breakdown'

describe('countByCountry', () => {
  it('tallies codes case-insensitively, biggest first', () => {
    expect(countByCountry(['AR', 'ar', 'AU', 'AR', 'pa', 'PA'])).toEqual([
      { countryCode: 'AR', count: 3 },
      { countryCode: 'PA', count: 2 },
      { countryCode: 'AU', count: 1 },
    ])
  })

  it('breaks ties alphabetically by Spanish name', () => {
    // Suiza (CH) sorts after Australia (AU) and Panamá (PA).
    expect(countByCountry(['CH', 'PA', 'AU']).map((c) => c.countryCode)).toEqual(['AU', 'PA', 'CH'])
  })

  it('groups missing countries and always lists them last', () => {
    expect(countByCountry([null, undefined, ' ', null, 'MT'])).toEqual([
      { countryCode: 'MT', count: 1 },
      { countryCode: null, count: 4 },
    ])
  })

  it('returns nothing for no rows', () => {
    expect(countByCountry([])).toEqual([])
  })
})
