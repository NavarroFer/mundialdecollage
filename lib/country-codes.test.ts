import { describe, expect, it } from 'vitest'
import { COUNTRY_CODES, COUNTRY_MARKER_COORDINATES } from './country-codes'
import { alpha2ForUnnumberedShape, isoNumericToAlpha2 } from './iso-numeric-country-codes'
import { countryCodeToName, guessCountryCodeFromName } from './participants'

const shapeCodes = new Set([...Object.values(isoNumericToAlpha2), ...Object.values(alpha2ForUnnumberedShape)])

describe('COUNTRY_CODES', () => {
  it('lets artists pick countries the world map cannot draw as a shape', () => {
    expect(COUNTRY_CODES).toEqual(expect.arrayContaining(['MT', 'SG', 'AD', 'HK', 'XK', 'BB']))
  })

  it('every pickable country can be painted on the map, as a shape or a dot', () => {
    const unpaintable = COUNTRY_CODES.filter((code) => !shapeCodes.has(code) && !(code in COUNTRY_MARKER_COORDINATES))
    expect(unpaintable).toEqual([])
  })

  it('only uses dots for countries without a shape, and only for pickable ones', () => {
    for (const code of Object.keys(COUNTRY_MARKER_COORDINATES)) {
      expect(shapeCodes.has(code)).toBe(false)
      expect(COUNTRY_CODES).toContain(code)
    }
  })

  it('keeps every country the map already drew pickable', () => {
    expect([...shapeCodes].filter((code) => !(COUNTRY_CODES as readonly string[]).includes(code))).toEqual([])
  })

  it('has a Spanish name for every code, and that name maps back to it', () => {
    for (const code of COUNTRY_CODES) {
      expect(countryCodeToName(code)).not.toBe(code)
      expect(guessCountryCodeFromName(countryCodeToName(code))).toBe(code)
    }
  })

  it('places every dot at a valid longitude/latitude', () => {
    for (const [lon, lat] of Object.values(COUNTRY_MARKER_COORDINATES)) {
      expect(Math.abs(lon)).toBeLessThanOrEqual(180)
      expect(Math.abs(lat)).toBeLessThanOrEqual(90)
    }
  })
})
