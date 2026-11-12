import { describe, expect, it } from 'vitest'
import { foldSearchText, searchCountries } from './map-country-search'

const countries = [
  { code: 'AR', name: 'Argentina' },
  { code: 'PE', name: 'Perú' },
  { code: 'MX', name: 'México' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GQ', name: 'Guinea Ecuatorial' },
]

describe('searchCountries', () => {
  it('returns everything for an empty query', () => {
    expect(searchCountries(countries, '  ')).toEqual(countries)
  })
  it('ignores accents and case', () => {
    expect(searchCountries(countries, 'PERU').map((c) => c.code)).toEqual(['PE'])
    expect(searchCountries(countries, 'mexi').map((c) => c.code)).toEqual(['MX'])
  })
  it('matches the start of any word, ahead of mere substrings', () => {
    expect(searchCountries(countries, 'uni').map((c) => c.code)).toEqual(['US'])
    expect(searchCountries(countries, 'ina').map((c) => c.code)).toEqual(['AR'])
  })
  it('finds nothing for an unknown name', () => {
    expect(searchCountries(countries, 'zzz')).toEqual([])
  })
  it('folds text', () => {
    expect(foldSearchText(' Ñandú ')).toBe('nandu')
  })
})
