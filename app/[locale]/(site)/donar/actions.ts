'use server'

import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { mercadoPago } from '@/lib/payments/providers/mercadopago'
import { payPal } from '@/lib/payments/providers/paypal'
import { donationExternalReference } from '@/lib/payments/references'
import type { Checkout, PaymentProvider } from '@/lib/payments/provider'
import { parseDonationAmount, parseDonationCurrency, parseDonationOrigin, type DonationCurrency } from '@/lib/donations'
import { getSiteUrl, site } from '@/lib/site'
import { trackServer } from '@/lib/track-server'

// An error code, not a sentence: the form says it in the reader's language,
// for the currency it was in (the donor may have switched since).
export type DonationState = { error: 'invalid' | 'unavailable' | null; currency?: DonationCurrency }

// Who takes each currency (lib/payments/provider.ts).
const PROVIDERS: Record<DonationCurrency, PaymentProvider> = { ARS: mercadoPago, USD: payPal }

// A donation (lib/donations.ts): straight to the provider's checkout for the
// amount picked, with no account, details or row of our own. Runs only when
// someone taps an amount, so the pages showing the buttons stay static.
export async function startDonation(_previous: DonationState, formData: FormData): Promise<DonationState> {
  const currency = parseDonationCurrency(formData.get('currency'))
  const amount = parseDonationAmount(formData.get('amount'), currency)
  if (amount === null) return { error: 'invalid', currency }
  const provider = PROVIDERS[currency]
  if (!provider.isConfigured) return { error: 'unavailable', currency }

  const origin = parseDonationOrigin(formData.get('from'))
  const siteUrl = getSiteUrl()
  const thanks = `${siteUrl}/donar/gracias`
  // A payment that didn't go through comes back to where the donor was.
  const back = origin === 'gallery' ? `${siteUrl}/galeria-3d` : `${siteUrl}/#donar`
  let checkout: Checkout
  try {
    checkout = await provider.createCheckout({
      reference: donationExternalReference(randomUUID()),
      items: [{ id: 'mundial-donacion', title: `Donación — ${site.name}`, quantity: 1, unitPrice: amount, currency }],
      returnUrls: { success: thanks, pending: thanks, failure: back },
    })
  } catch (err) {
    console.error('startDonation: failed to create checkout', provider.id, amount, err)
    return { error: 'unavailable', currency }
  }

  await trackServer(origin === 'gallery' ? 'donation_checkout_start_gallery' : 'donation_checkout_start_home', null)
  if (currency === 'USD') await trackServer('donation_checkout_start_paypal', null)
  redirect(checkout.url)
}
