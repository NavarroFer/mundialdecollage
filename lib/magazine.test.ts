import { describe, expect, it } from 'vitest'
import { magazineOrderAmount, parseMagazineOrder, type MagazineField } from './magazine'

const valid: Record<MagazineField, string> = {
  name: '  Ana   Pérez ',
  email: 'Ana@Example.com',
  phone: '+54 223 555-1234',
  address_line_1: 'Av. Colón 1234',
  address_line_2: '',
  city: 'Mar del Plata',
  province: 'Buenos Aires',
  postal_code: 'b7600 abc',
  country_code: 'AR',
  quantity: '2',
}

const parse = (overrides: Partial<Record<MagazineField, string>> = {}, allowAbroad = true) =>
  parseMagazineOrder((field) => ({ ...valid, ...overrides })[field], 5, allowAbroad)

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
        shipping: { address_line_1: 'Av. Colón 1234', address_line_2: '', city: 'Mar del Plata', province: 'Buenos Aires', postal_code: 'B7600ABC', country_code: 'AR' },
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

  it('ships abroad with that country\'s postal codes', () => {
    const result = parse({ country_code: 'es', postal_code: '28013', province: 'Madrid', city: 'Madrid' })
    expect(result.ok && result.order.shipping).toMatchObject({ country_code: 'ES', postal_code: '28013' })
    expect(parse({ country_code: 'GB', postal_code: 'SW1A 1AA' }).ok).toBe(true)
  })

  it('only ships within Argentina while shipping abroad has no price', () => {
    expect(parse({ country_code: 'ES', postal_code: '28013' }, false)).toEqual({ ok: false, invalid: ['country_code'] })
    expect(parse({}, false).ok).toBe(true)
  })
})

describe('magazineOrderAmount', () => {
  it('adds one shipping fee for orders abroad', () => {
    expect(magazineOrderAmount(20000, 2, 'AR', 15000)).toBe(40000)
    expect(magazineOrderAmount(20000, 2, 'ES', 15000)).toBe(55000)
  })
})
