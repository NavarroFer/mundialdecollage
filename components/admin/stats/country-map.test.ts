import { describe, expect, it } from 'vitest'
import { countryDepth } from './country-map'

describe('countryDepth', () => {
  it('leaves countries with nobody uncolored and paints the leader full', () => {
    expect(countryDepth(0, 128)).toBe(0)
    expect(countryDepth(128, 128)).toBe(1)
  })

  it('keeps one big country from washing out the rest', () => {
    // A country with a sixteenth of the leader still reads at well over a sixteenth of its blue.
    expect(countryDepth(8, 128)).toBeCloseTo(0.4)
    expect(countryDepth(1, 128)).toBeGreaterThan(0.2)
  })
})
