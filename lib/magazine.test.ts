import { describe, expect, it } from 'vitest'
import { parseMagazineOrder, type MagazineField } from './magazine'

const valid: Record<MagazineField, string> = {
  name: '  Ana   Pérez ',
  email: 'Ana@Example.com',
  phone: '+54 223 555-1234',
  address_line_1: 'Av. Colón 1234',
  address_line_2: '',
  city: 'Mar del Plata',
  province: 'Buenos Aires',
  postal_code: 'b7600 abc',
  quantity: '2',
}

const parse = (overrides: Partial<Record<MagazineField, string>> = {}) =>
  parseMagazineOrder((field) => ({ ...valid, ...overrides })[field], 5)

describe('parseMagazineOrder', () => {
  it('normalizes a valid order', () => {
    const result = parse({ postal_code: 'B7600ABC' })
    expect(result).toEqual({
      ok: true,
      order: {
        name: 'Ana Pérez',
        email: 'ana@example.com',
        phone: '+54 223 555-1234',
        quantity: 2,
        shipping: { address_line_1: 'Av. Colón 1234', address_line_2: '', city: 'Mar del Plata', province: 'Buenos Aires', postal_code: 'B7600ABC' },
      },
    })
  })

  it('accepts a four-digit postal code', () => {
    expect(parse({ postal_code: '7600' }).ok).toBe(true)
  })

  it('reports every invalid field', () => {
    const result = parse({ email: 'nope', phone: '12', postal_code: 'X', quantity: '0' })
    expect(result).toEqual({ ok: false, invalid: ['email', 'phone', 'postal_code', 'quantity'] })
  })

  it('caps the quantity', () => {
    expect(parse({ quantity: '6' })).toEqual({ ok: false, invalid: ['quantity'] })
    expect(parse({ quantity: '1.5' })).toEqual({ ok: false, invalid: ['quantity'] })
  })

  it('treats missing fields as empty', () => {
    const result = parseMagazineOrder(() => undefined, 5)
    expect(result.ok).toBe(false)
  })
})
