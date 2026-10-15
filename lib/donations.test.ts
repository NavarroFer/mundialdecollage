import { describe, expect, it } from 'vitest'
import { DONATION_AMOUNTS_ARS, DONATION_MAX_ARS, DONATION_MIN_ARS, parseDonationAmount, parseDonationOrigin } from './donations'

describe('parseDonationAmount', () => {
  it('takes the suggested amounts and whatever is typed in pesos', () => {
    for (const amount of DONATION_AMOUNTS_ARS) expect(parseDonationAmount(String(amount))).toBe(amount)
    expect(parseDonationAmount('15.000')).toBe(15000)
    expect(parseDonationAmount('$ 15.000')).toBe(15000)
    expect(parseDonationAmount(' 7500 ')).toBe(7500)
  })

  it('refuses what is outside the limits or not whole pesos', () => {
    expect(parseDonationAmount(String(DONATION_MIN_ARS - 1))).toBeNull()
    expect(parseDonationAmount(String(DONATION_MAX_ARS + 1))).toBeNull()
    expect(parseDonationAmount('5000,50')).toBeNull()
    expect(parseDonationAmount('-5000')).toBeNull()
    expect(parseDonationAmount('')).toBeNull()
    expect(parseDonationAmount(null)).toBeNull()
  })
})

describe('parseDonationOrigin', () => {
  it('falls back to the home for anything but the gallery', () => {
    expect(parseDonationOrigin('gallery')).toBe('gallery')
    expect(parseDonationOrigin('home')).toBe('home')
    expect(parseDonationOrigin('admin')).toBe('home')
    expect(parseDonationOrigin(null)).toBe('home')
  })
})
