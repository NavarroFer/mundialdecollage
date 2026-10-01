'use server'

import { redirect } from 'next/navigation'
import { PreApproval } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { subscriptionExternalReference } from '@/lib/entries'
import { MAGAZINE_FIELDS, parseMagazineOrder, type MagazineField } from '@/lib/magazine'
import { upsertCustomer } from '@/lib/payments/customers'
import { mpPlanId } from '@/lib/subscription-receipts'
import { planById } from '@/lib/store'
import { getSiteUrl } from '@/lib/site'
import { trackServer } from '@/lib/track-server'

// Same contract as the magazine's checkout: error codes and the field names
// to mark, plus what was typed (React resets a form after its action runs).
export type MpSubscriptionState = {
  error: 'invalid' | 'unavailable' | null
  invalid: MagazineField[]
  values: Partial<Record<MagazineField, string>>
}

// A store subscription in Argentina: a Mercado Pago preapproval charging the
// plan's priceArs every month. The local row is created first (service role,
// status pending) and the preapproval's notifications move it from there
// (lib/mp-subscriptions.ts).
export async function startMpSubscription(planId: string, _previous: MpSubscriptionState, formData: FormData): Promise<MpSubscriptionState> {
  // The shipping form is the magazine's, always in Argentina, one "copy".
  const read = (field: MagazineField) => (field === 'quantity' ? '1' : field === 'country_code' ? 'AR' : formData.get(field))
  const values = Object.fromEntries(MAGAZINE_FIELDS.map((field) => [field, String(read(field) ?? '').slice(0, 300)])) as Record<MagazineField, string>
  const unavailable: MpSubscriptionState = { error: 'unavailable', invalid: [], values }
  if (formData.get('website')) return unavailable
  const plan = planById(planId)
  if (!plan || !isMercadoPagoConfigured || !isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return unavailable

  const parsed = parseMagazineOrder(read, 1, false)
  if (!parsed.ok) return { error: 'invalid', invalid: parsed.invalid, values }
  const { order } = parsed

  const admin = createAdminClient()
  let subscriptionId: string
  try {
    const customerId = await upsertCustomer(order.email, order.name)
    const { data, error } = await admin
      .from('subscriptions')
      .insert({
        customer_id: customerId,
        provider: 'mercadopago',
        provider_plan_id: mpPlanId(plan.id),
        // Same shape as PayPal's, so the store admin reads both alike.
        shipping_address: {
          full_name: order.name,
          address_line_1: order.shipping.address_line_1,
          address_line_2: order.shipping.address_line_2,
          admin_area_2: order.shipping.city,
          admin_area_1: order.shipping.province,
          postal_code: order.shipping.postal_code,
          country_code: 'AR',
          phone: order.phone,
        },
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'no row')
    subscriptionId = data.id
  } catch (err) {
    console.error('startMpSubscription: failed to create subscription', err)
    return unavailable
  }

  let initPoint: string | undefined
  try {
    const preapproval = await new PreApproval(getMercadoPagoConfig()).create({
      body: {
        reason: `Papel por correo — plan ${plan.id} (Mundial de Collage)`,
        external_reference: subscriptionExternalReference(subscriptionId),
        payer_email: order.email,
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: plan.priceArs, currency_id: 'ARS' },
        back_url: `${getSiteUrl()}/gracias?tipo=suscripcion`,
        status: 'pending',
      },
    })
    initPoint = preapproval.init_point
    await admin.from('subscriptions').update({ provider_subscription_id: preapproval.id }).eq('id', subscriptionId)
  } catch (err) {
    console.error('startMpSubscription: failed to create preapproval', subscriptionId, err)
    return unavailable
  }
  if (!initPoint) return unavailable

  await trackServer('store_checkout_start', null)
  redirect(initPoint)
}
