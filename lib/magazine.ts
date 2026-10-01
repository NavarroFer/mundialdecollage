// The preventa form of the Revista 1ª Edición (app/revista), validated on the
// server before an order row or a Mercado Pago preference exists. Pure, so
// it's tested on its own (lib/magazine.test.ts).

export type MagazineShipping = {
  address_line_1: string
  address_line_2: string
  city: string
  province: string
  postal_code: string
}

export type MagazineOrderInput = {
  name: string
  email: string
  phone: string
  shipping: MagazineShipping
  quantity: number
}

export const MAGAZINE_FIELDS = ['name', 'email', 'phone', 'address_line_1', 'address_line_2', 'city', 'province', 'postal_code', 'quantity'] as const
export type MagazineField = (typeof MAGAZINE_FIELDS)[number]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Digits with the usual separators; 6–20 digits covers local and +54 numbers.
const PHONE_PATTERN = /^\+?[\d\s().-]+$/
// Argentine CP: 4 digits, or the CPA form like C1425ABC.
const POSTAL_PATTERN = /^([a-z]\d{4}[a-z]{3}|\d{4})$/i

const text = (value: unknown) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '')

export function parseMagazineOrder(
  get: (field: MagazineField) => unknown,
  maxQuantity: number,
): { ok: true; order: MagazineOrderInput } | { ok: false; invalid: MagazineField[] } {
  const values = Object.fromEntries(MAGAZINE_FIELDS.map((field) => [field, text(get(field))])) as Record<MagazineField, string>
  const quantity = Number(values.quantity)
  const phoneDigits = values.phone.replace(/\D/g, '').length
  const checks: Record<MagazineField, boolean> = {
    name: values.name.length >= 2 && values.name.length <= 120,
    email: values.email.length <= 254 && EMAIL_PATTERN.test(values.email),
    phone: PHONE_PATTERN.test(values.phone) && phoneDigits >= 6 && phoneDigits <= 20,
    address_line_1: values.address_line_1.length >= 3 && values.address_line_1.length <= 200,
    address_line_2: values.address_line_2.length <= 100,
    city: values.city.length >= 2 && values.city.length <= 100,
    province: values.province.length >= 2 && values.province.length <= 100,
    postal_code: POSTAL_PATTERN.test(values.postal_code.replace(/\s/g, '')),
    quantity: Number.isInteger(quantity) && quantity >= 1 && quantity <= maxQuantity,
  }
  const invalid = MAGAZINE_FIELDS.filter((field) => !checks[field])
  if (invalid.length) return { ok: false, invalid }
  return {
    ok: true,
    order: {
      name: values.name,
      email: values.email.toLowerCase(),
      phone: values.phone,
      quantity,
      shipping: {
        address_line_1: values.address_line_1,
        address_line_2: values.address_line_2,
        city: values.city,
        province: values.province,
        postal_code: values.postal_code.replace(/\s/g, '').toUpperCase(),
      },
    },
  }
}
