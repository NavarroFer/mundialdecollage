// Donations: the Mundial is self-funded, and anyone can give to it from the
// home or the gallery's start screen (app/[locale]/(site)/donar/actions.ts):
// in pesos through Mercado Pago from Argentina, in dollars through PayPal
// from anywhere else. Nothing is stored when the checkout opens: the
// "donacion:" reference tells the webhooks it's a donation, and the payment
// they report is recorded then (lib/donation-payments.ts).

export const DONATION_CURRENCIES = ['ARS', 'USD'] as const

export type DonationCurrency = (typeof DONATION_CURRENCIES)[number]

/** The buttons, and what «Otro monto» accepts, in whole units of each currency. */
export const DONATION_LIMITS: Record<DonationCurrency, { amounts: readonly number[]; min: number; max: number }> = {
  ARS: { amounts: [5000, 10000, 20000], min: 1000, max: 1_000_000 },
  USD: { amounts: [5, 10, 20], min: 2, max: 1000 },
}

export const DONATION_ORIGINS = ['home', 'gallery'] as const

export type DonationOrigin = (typeof DONATION_ORIGINS)[number]

export function parseDonationCurrency(value: unknown): DonationCurrency {
  return value === 'USD' ? 'USD' : 'ARS'
}

/**
 * Whole units within the currency's limits, or null. Pesos also take "15.000"
 * or "$ 15.000"; dollars never drop a dot, so "10.50" isn't read as 1050.
 */
export function parseDonationAmount(value: unknown, currency: DonationCurrency = 'ARS'): number | null {
  const digits = typeof value === 'string' ? value.replace(currency === 'ARS' ? /[\s$.]/g : /[\s$]|US/g, '') : ''
  if (!/^\d{1,9}$/.test(digits)) return null
  const amount = Number(digits)
  const { min, max } = DONATION_LIMITS[currency]
  return amount >= min && amount <= max ? amount : null
}

export function parseDonationOrigin(value: unknown): DonationOrigin {
  return value === 'gallery' ? 'gallery' : 'home'
}

// Argentina's time zones, and the old names some systems still report.
const ARGENTINA_TIME_ZONES = ['America/Buenos_Aires', 'America/Catamarca', 'America/Cordoba', 'America/Jujuy', 'America/Mendoza', 'America/Rosario']

/**
 * Which currency to offer first, by the time zone the device is set to: the
 * browser knows it with no request, so the pages stay static, and it rarely
 * says Argentina for someone abroad. Pesos when it's unknown, as the store
 * does; the form lets anyone switch.
 */
export function donationCurrencyFor(timeZone: string | undefined): DonationCurrency {
  if (!timeZone) return 'ARS'
  return timeZone.startsWith('America/Argentina/') || ARGENTINA_TIME_ZONES.includes(timeZone) ? 'ARS' : 'USD'
}
