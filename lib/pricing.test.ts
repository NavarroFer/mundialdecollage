import { describe, expect, it } from 'vitest'
import { priceWithFee } from './pricing'

describe('priceWithFee', () => {
  it('grosses up so the fee leaves the net amount intact', () => {
    const gross = priceWithFee(10000, 3.99)
    expect(gross).toBeCloseTo(10415.58, 2)
    // Charging `gross` and taking 3.99% off it should return ~netAmount —
    // this is the actual property that matters, independent of rounding.
    const feeTaken = gross * (3.99 / 100)
    expect(gross - feeTaken).toBeCloseTo(10000, 0)
  })

  it('returns the input unchanged for a zero fee', () => {
    expect(priceWithFee(10000, 0)).toBe(10000)
  })

  it('returns the input as-is for non-positive amounts (nothing to gross up)', () => {
    expect(priceWithFee(0, 3.99)).toBe(0)
    expect(priceWithFee(-500, 3.99)).toBe(-500)
  })

  it('returns the input as-is for a negative fee', () => {
    expect(priceWithFee(10000, -1)).toBe(10000)
  })
})
