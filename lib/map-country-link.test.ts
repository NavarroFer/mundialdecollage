import { describe, expect, it } from 'vitest'
import { countryFromMapHash, mapCountryHash } from './map-country-link'

describe('map country links', () => {
  it('round-trips a country code through the hash', () => {
    expect(mapCountryHash('ar')).toBe('#mapa-AR')
    expect(countryFromMapHash(mapCountryHash('ar'))).toBe('AR')
  })

  it('ignores hashes that are not a map country', () => {
    expect(countryFromMapHash('#mapa')).toBeNull()
    expect(countryFromMapHash('#mapa-ARG')).toBeNull()
    expect(countryFromMapHash('#participantes')).toBeNull()
    expect(countryFromMapHash('')).toBeNull()
  })
})
