'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { mercadoPago } from '@/lib/payments/providers/mercadopago'
import { magazineExternalReference } from '@/lib/payments/references'
import type { Checkout } from '@/lib/payments/provider'
import { MAGAZINE_FIELDS, magazineOrderAmount, parseMagazineOrder, shipsAbroad, type MagazineField } from '@/lib/magazine'
import { getSiteUrl, isMagazineSaleOpen, site } from '@/lib/site'
import { trackServer } from '@/lib/track-server'

// Error codes and field names, not sentences: the form shows them in the
// reader's language.
// `values` comes back so the form can show what was typed: React resets a
// form after its action runs.
export type MagazineCheckoutState = {
  error: 'invalid' | 'unavailable' | null
  invalid: MagazineField[]
  values: Partial<Record<MagazineField, string>>
}

// Preventa de la Revista 1ª Edición: same Checkout Pro flow as the extra obras
// (app/onboarding/obras/actions.ts). No account needed to buy; the order row
// is written with the service-role client so nobody can create one that
// already says "paid".
export async function startMagazineCheckout(_previous: MagazineCheckoutState, formData: FormData): Promise<MagazineCheckoutState> {
  const values = Object.fromEntries(
    MAGAZINE_FIELDS.map((field) => [field, String(formData.get(field) ?? '').slice(0, 300)]),
  ) as Record<MagazineField, string>
  const unavailable: MagazineCheckoutState = { error: 'unavailable', invalid: [], values }
  // Honeypot: hidden from people, filled in by bots.
  if (formData.get('website')) return unavailable
  const priceArs = site.magazine.priceArs
  if (!isMagazineSaleOpen() || priceArs === null || !isSupabaseConfigured || !mercadoPago.isConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return unavailable
  }

  const { shippingAbroadArs } = site.magazine
  const parsed = parseMagazineOrder((field) => formData.get(field), site.magazine.maxQuantity, shippingAbroadArs !== null)
  if (!parsed.ok) return { error: 'invalid', invalid: parsed.invalid, values }
  const { order } = parsed

  const { data: { user } } = await (await createClient()).auth.getUser()
  const abroad = shipsAbroad(order.shipping.country_code)
  const amount = magazineOrderAmount(priceArs, order.quantity, order.shipping.country_code, shippingAbroadArs)
  const admin = createAdminClient()
  const { data: row, error: insertError } = await admin
    .from('magazine_orders')
    .insert({
      user_id: user?.id ?? null,
      email: order.email,
      name: order.name,
      phone: order.phone,
      shipping_address: order.shipping,
      quantity: order.quantity,
      amount,
      currency: 'ARS',
    })
    .select('id')
    .single()
  if (insertError || !row) {
    console.error('startMagazineCheckout: failed to create order', insertError)
    return unavailable
  }

  const siteUrl = getSiteUrl()
  const thanks = `${siteUrl}/revista/gracias?pedido=${row.id}`
  let checkout: Checkout
  try {
    checkout = await mercadoPago.createCheckout({
      reference: magazineExternalReference(row.id),
      items: [
        {
          id: 'mundial-revista-1',
          title: 'Revista Mundial de Collage — 1ª edición (impresa)',
          quantity: order.quantity,
          unitPrice: priceArs,
          currency: 'ARS',
        },
        ...(abroad && shippingAbroadArs
          ? [{ id: 'mundial-revista-envio', title: 'Envío internacional', quantity: 1, unitPrice: shippingAbroadArs, currency: 'ARS' as const }]
          : []),
      ],
      payer: { email: order.email, name: order.name },
      returnUrls: { success: thanks, pending: thanks, failure: thanks },
    })
    await admin.from('magazine_orders').update({ mp_preference_id: checkout.id }).eq('id', row.id)
  } catch (err) {
    console.error('startMagazineCheckout: failed to create checkout', row.id, err)
    return unavailable
  }

  await trackServer('magazine_checkout_start', user?.id ?? null)
  redirect(checkout.url)
}
