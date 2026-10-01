import { describe, expect, it } from 'vitest'
import { formatAddress, formatMoney, localeFromCountry } from './receipts'

describe('formatAddress', () => {
  it('reads the magazine shape', () => {
    expect(formatAddress({ address_line_1: 'Av. Colón 1234', address_line_2: '3B', city: 'Mar del Plata', province: 'Buenos Aires', postal_code: 'B7600ABC', country_code: 'AR' }))
      .toBe('Av. Colón 1234, 3B · Mar del Plata, Buenos Aires · B7600ABC · Argentina')
  })

  it('reads the PayPal shape and defaults to Argentina', () => {
    expect(formatAddress({ address_line_1: 'Calle 1', admin_area_2: 'Rosario', admin_area_1: 'Santa Fe', postal_code: '2000' }))
      .toBe('Calle 1 · Rosario, Santa Fe · 2000 · Argentina')
  })

  it('handles a missing address', () => {
    expect(formatAddress(null)).toBe('—')
  })
})

describe('formatMoney / localeFromCountry', () => {
  it('formats in the buyer’s language', () => {
    expect(formatMoney(30000, 'ARS', 'es')).toMatch(/30\.000/)
    expect(localeFromCountry('BR')).toBe('pt')
    expect(localeFromCountry(null)).toBe('es')
  })
})
