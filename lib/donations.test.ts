import { describe, expect, it } from 'vitest'
import { DONATION_LIMITS, donationCurrencyFor, parseDonationAmount, parseDonationCurrency, parseDonationOrigin } from './donations'

describe('parseDonationAmount', () => {
  it('takes the suggested amounts and whatever is typed in pesos', () => {
    for (const amount of DONATION_LIMITS.ARS.amounts) expect(parseDonationAmount(String(amount))).toBe(amount)
    expect(parseDonationAmount('15.000')).toBe(15000)
    expect(parseDonationAmount('$ 15.000')).toBe(15000)
    expect(parseDonationAmount(' 7500 ')).toBe(7500)
  })

  it('refuses what is outside the limits or not whole pesos', () => {
    expect(parseDonationAmount(String(DONATION_LIMITS.ARS.min - 1))).toBeNull()
    expect(parseDonationAmount(String(DONATION_LIMITS.ARS.max + 1))).toBeNull()
    expect(parseDonationAmount('5000,50')).toBeNull()
    expect(parseDonationAmount('-5000')).toBeNull()
    expect(parseDonationAmount('')).toBeNull()
    expect(parseDonationAmount(null)).toBeNull()
  })

  it('takes whole dollars within their own limits', () => {
    for (const amount of DONATION_LIMITS.USD.amounts) expect(parseDonationAmount(String(amount), 'USD')).toBe(amount)
    expect(parseDonationAmount('US$ 50', 'USD')).toBe(50)
    expect(parseDonationAmount(String(DONATION_LIMITS.USD.min - 1), 'USD')).toBeNull()
    expect(parseDonationAmount(String(DONATION_LIMITS.USD.max + 1), 'USD')).toBeNull()
    // A pesos amount is far over the dollars' limit.
    expect(parseDonationAmount('5000', 'USD')).toBeNull()
  })

  it('never reads a dollar amount with cents as more dollars', () => {
    expect(parseDonationAmount('10.50', 'USD')).toBeNull()
    expect(parseDonationAmount('1.000', 'USD')).toBeNull()
  })
})

describe('parseDonationCurrency', () => {
  it('falls back to pesos for anything but dollars', () => {
    expect(parseDonationCurrency('USD')).toBe('USD')
    expect(parseDonationCurrency('ARS')).toBe('ARS')
    expect(parseDonationCurrency('EUR')).toBe('ARS')
    expect(parseDonationCurrency(null)).toBe('ARS')
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

describe('donationCurrencyFor', () => {
  it('offers pesos to a device set to any of Argentina’s time zones', () => {
    expect(donationCurrencyFor('America/Argentina/Buenos_Aires')).toBe('ARS')
    expect(donationCurrencyFor('America/Argentina/Ushuaia')).toBe('ARS')
    expect(donationCurrencyFor('America/Buenos_Aires')).toBe('ARS')
    expect(donationCurrencyFor('America/Cordoba')).toBe('ARS')
  })

  it('offers dollars everywhere else, even next door', () => {
    expect(donationCurrencyFor('America/Montevideo')).toBe('USD')
    expect(donationCurrencyFor('America/Sao_Paulo')).toBe('USD')
    expect(donationCurrencyFor('Europe/Madrid')).toBe('USD')
    expect(donationCurrencyFor('UTC')).toBe('USD')
  })

  it('stays with pesos when the time zone is unknown', () => {
    expect(donationCurrencyFor(undefined)).toBe('ARS')
    expect(donationCurrencyFor('')).toBe('ARS')
  })
})
