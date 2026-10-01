'use server'

import { redirect } from 'next/navigation'
import { Preference } from 'mercadopago'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { magazineExternalReference } from '@/lib/entries'
import { MAGAZINE_FIELDS, parseMagazineOrder, type MagazineField } from '@/lib/magazine'
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
  if (!isMagazineSaleOpen() || priceArs === null || !isSupabaseConfigured || !isMercadoPagoConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return unavailable
  }

  const parsed = parseMagazineOrder((field) => formData.get(field), site.magazine.maxQuantity)
  if (!parsed.ok) return { error: 'invalid', invalid: parsed.invalid, values }
  const { order } = parsed

  const { data: { user } } = await (await createClient()).auth.getUser()
  const amount = priceArs * order.quantity
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
  let initPoint: string | undefined
  try {
    const preference = await new Preference(getMercadoPagoConfig()).create({
      body: {
        items: [
          {
            id: 'mundial-revista-1',
            title: 'Revista Mundial de Collage — 1ª edición (impresa, envío incluido)',
            quantity: order.quantity,
            unit_price: priceArs,
            currency_id: 'ARS',
          },
        ],
        payer: { email: order.email, name: order.name },
        external_reference: magazineExternalReference(row.id),
        back_urls: { success: thanks, pending: thanks, failure: thanks },
        auto_return: 'approved',
        notification_url: `${siteUrl}/api/mercadopago/webhook`,
      },
    })
    initPoint = preference.init_point
    await admin.from('magazine_orders').update({ mp_preference_id: preference.id }).eq('id', row.id)
  } catch (err) {
    console.error('startMagazineCheckout: failed to create preference', row.id, err)
    return unavailable
  }
  if (!initPoint) return unavailable

  await trackServer('magazine_checkout_start', user?.id ?? null)
  redirect(initPoint)
}
