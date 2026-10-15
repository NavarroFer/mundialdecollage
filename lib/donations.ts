// Donations: the Mundial is self-funded, and anyone can give to it in pesos
// through Mercado Pago (app/[locale]/(site)/donar/actions.ts), from the home
// or the gallery's start screen. Nothing is stored here: Mercado Pago's own
// records are the ledger, and the "donacion:" reference only keeps its
// webhook from mistaking a donation for something sold here.

/** The buttons, in pesos. */
export const DONATION_AMOUNTS_ARS = [5000, 10000, 20000] as const

// What «Otro monto» accepts.
export const DONATION_MIN_ARS = 1000
export const DONATION_MAX_ARS = 1_000_000

export const DONATION_ORIGINS = ['home', 'gallery'] as const

export type DonationOrigin = (typeof DONATION_ORIGINS)[number]

/** Whole pesos within the limits, or null. Takes "15000" as well as "15.000" or "$ 15.000". */
export function parseDonationAmount(value: unknown): number | null {
  const digits = typeof value === 'string' ? value.replace(/[\s$.]/g, '') : ''
  if (!/^\d{1,9}$/.test(digits)) return null
  const amount = Number(digits)
  return amount >= DONATION_MIN_ARS && amount <= DONATION_MAX_ARS ? amount : null
}

export function parseDonationOrigin(value: unknown): DonationOrigin {
  return value === 'gallery' ? 'gallery' : 'home'
}
