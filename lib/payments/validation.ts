import { z } from 'zod'

export const addressSchema = z.object({
  full_name: z.string().trim().min(2).max(300),
  address_line_1: z.string().trim().min(2).max(300),
  address_line_2: z.string().trim().max(300).optional().default(''),
  admin_area_2: z.string().trim().min(1).max(120),
  admin_area_1: z.string().trim().max(300).optional().default(''),
  postal_code: z.string().trim().max(60).optional().default(''),
  country_code: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  // The courier's delivery updates; same rule as the Argentine checkout (lib/magazine.ts).
  phone: z.string().trim().max(30).regex(/^\+?[\d\s().-]+$/).refine((value) => { const digits = value.replace(/\D/g, '').length; return digits >= 6 && digits <= 20 }),
})

export const customerSchema = z.object({
  email: z.string().trim().email(),
  given_name: z.string().trim().min(1).max(140),
  surname: z.string().trim().min(1).max(140),
})

export type Address = z.infer<typeof addressSchema>

export function toPaypalAddress(address: Address) {
  const { full_name, phone: _phone, ...paypalAddress } = address
  return { name: { full_name }, address: paypalAddress }
}
