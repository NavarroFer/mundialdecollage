'use server'

import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { mercadoPago } from '@/lib/payments/providers/mercadopago'
import { donationExternalReference } from '@/lib/payments/references'
import type { Checkout } from '@/lib/payments/provider'
import { parseDonationAmount, parseDonationOrigin } from '@/lib/donations'
import { getSiteUrl, site } from '@/lib/site'
import { trackServer } from '@/lib/track-server'

// An error code, not a sentence: the form says it in the reader's language.
export type DonationState = { error: 'invalid' | 'unavailable' | null }

// A donation (lib/donations.ts): straight to a Checkout Pro preference for
// the amount picked, with no account, details or row of our own. Runs only
// when someone taps an amount, so the pages showing the buttons stay static.
export async function startDonation(_previous: DonationState, formData: FormData): Promise<DonationState> {
  const amount = parseDonationAmount(formData.get('amount'))
  if (amount === null) return { error: 'invalid' }
  if (!mercadoPago.isConfigured) return { error: 'unavailable' }

  const origin = parseDonationOrigin(formData.get('from'))
  const siteUrl = getSiteUrl()
  const thanks = `${siteUrl}/donar/gracias`
  // A payment that didn't go through comes back to where the donor was.
  const back = origin === 'gallery' ? `${siteUrl}/galeria-3d` : `${siteUrl}/#donar`
  let checkout: Checkout
  try {
    checkout = await mercadoPago.createCheckout({
      reference: donationExternalReference(randomUUID()),
      items: [{ id: 'mundial-donacion', title: `Donación — ${site.name}`, quantity: 1, unitPrice: amount, currency: 'ARS' }],
      returnUrls: { success: thanks, pending: thanks, failure: back },
    })
  } catch (err) {
    console.error('startDonation: failed to create checkout', amount, err)
    return { error: 'unavailable' }
  }

  await trackServer(origin === 'gallery' ? 'donation_checkout_start_gallery' : 'donation_checkout_start_home', null)
  redirect(checkout.url)
}
