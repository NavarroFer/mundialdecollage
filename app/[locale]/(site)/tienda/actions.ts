'use server'

import { resolvePickup, quoteSubscriptionShipping } from '@/lib/correo'

import { redirect } from 'next/navigation'
import { createHash } from 'node:crypto'
import { PreApproval } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { subscriptionExternalReference } from '@/lib/payments/references'
import { MAGAZINE_FIELDS, parseMagazineOrder, type MagazineField } from '@/lib/magazine'
import { upsertCustomer } from '@/lib/payments/customers'
import { mpPlanId } from '@/lib/subscription-receipts'
import { planById } from '@/lib/store'
import { getSiteUrl } from '@/lib/site'
import { trackServer } from '@/lib/track-server'
import { subscriptionCheckoutError } from '@/lib/subscription-checkout-error'
import { recordCustomerPaymentError, type PaymentErrorStage } from '@/lib/customer-payment-errors'
import { syncPreapprovalById } from '@/lib/mp-subscriptions'

// Same contract as the magazine's checkout: error codes and the field names
// to mark, plus what was typed (React resets a form after its action runs).
export type MpSubscriptionState = {
  error: 'invalid' | 'unavailable' | null
  invalid: MagazineField[]
  values: Partial<Record<MagazineField, string>>
  paymentError?: 'funds' | 'card' | 'rejected'
  subscription?: { id: string; status: 'active' | 'pending' }
}

// A store subscription in Argentina: a Mercado Pago preapproval charging the
// plan price plus the authorized shipping quote every month. The local row is created first (service role,
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

  if (!formData.get('branch_code')) return { error: 'invalid', invalid: ['branch_code'], values }
  let pickup: Awaited<ReturnType<typeof resolvePickup>>
  try { pickup = await resolvePickup(String(formData.get('province') ?? ''), String(formData.get('branch_code') ?? '')) } catch { return unavailable }
  if (!pickup) return { error: 'invalid', invalid: ['branch_code'], values }
  formData.set('address_line_1', pickup.address)
  formData.set('address_line_2', '')
  formData.set('city', pickup.locality || pickup.city)
  formData.set('postal_code', pickup.postalCode)

  const parsed = parseMagazineOrder(read, 1, false)
  if (!parsed.ok) return { error: 'invalid', invalid: parsed.invalid, values }
  const { order } = parsed
  let shippingFee = 0
  try { shippingFee = await quoteSubscriptionShipping(plan.id, pickup) } catch { return unavailable }
  if (!formData.get('shipping_fee') || Number(formData.get('shipping_fee')) !== shippingFee) return { error: 'invalid', invalid: ['shipping_fee'], values }
  const billingAmount = Math.round((plan.priceArs + shippingFee) * 100) / 100
  if (pickup) Object.assign(order.shipping, {
    delivery_type: 'branch', branch_code: pickup.code, branch_name: pickup.name,
    shipping_payment: 'monthly', shipping_fee: shippingFee, billing_amount: billingAmount,
  })
  const withCard = formData.get('payment_method') === 'card'
  const cardToken = String(formData.get('card_token') ?? '')
  const payerEmail = String(formData.get('payer_email') ?? order.email).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail) || payerEmail.length > 254) return { error: 'invalid', invalid: ['email'], values }
  if (withCard && (!process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || !/^[a-zA-Z0-9_-]{6,250}$/.test(cardToken))) return unavailable

  const admin = createAdminClient()
  let subscriptionId: string
  let customerId: string | undefined
  try {
    customerId = await upsertCustomer(order.email, order.name)
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
          ...(pickup ? { delivery_type: 'branch', branch_code: pickup.code, branch_name: pickup.name, recipient_name: order.shipping.recipient_name || order.name, shipping_payment: 'monthly', shipping_fee: shippingFee, billing_amount: billingAmount } : {}),
        },
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'no row')
    subscriptionId = data.id
  } catch (err) {
    console.error('startMpSubscription: failed to create subscription', subscriptionCheckoutError('create_subscription', err))
    await recordCustomerPaymentError({ customerId, stage: 'create_subscription', error: err })
    return unavailable
  }

  let initPoint: string | undefined
  let stage: PaymentErrorStage = 'create_preapproval'
  let providerId: string | undefined
  let providerStatus: string | undefined
  try {
    const preapproval = await new PreApproval(getMercadoPagoConfig()).create({
      body: {
        reason: `Papel por correo — plan ${plan.id} (Mundial de Collage)`,
        external_reference: subscriptionExternalReference(subscriptionId),
        payer_email: payerEmail,
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: billingAmount, currency_id: 'ARS' },
        back_url: `${getSiteUrl()}/gracias?tipo=suscripcion`,
        status: withCard ? 'authorized' : 'pending',
        ...(withCard ? { card_token_id: cardToken } : {}),
      },
      ...(withCard ? { requestOptions: { idempotencyKey: createHash('sha256').update(`${plan.id}:${payerEmail}:${cardToken}`).digest('hex') } } : {}),
    })
    providerId = preapproval.id
    providerStatus = preapproval.status
    initPoint = preapproval.init_point
    stage = 'save_preapproval'
    if (!preapproval.id) throw new Error('Mercado Pago returned no subscription ID')
    const { error } = await admin.from('subscriptions').update({ provider_subscription_id: preapproval.id }).eq('id', subscriptionId)
    if (error) throw new Error(error.message)
    stage = 'checkout_url'
    if (!withCard && !initPoint) throw new Error('Mercado Pago returned no checkout URL')
    if (withCard && !['authorized', 'pending'].includes(providerStatus ?? '')) throw new Error('Mercado Pago did not authorize the subscription')
  } catch (err) {
    const diagnostic = subscriptionCheckoutError(stage, err, [cardToken])
    console.error('startMpSubscription: checkout failed', subscriptionId, diagnostic)
    await recordCustomerPaymentError({ customerId, subscriptionId, stage, error: diagnostic })
    try {
      const { error } = await admin.from('subscriptions').update({ checkout_error: diagnostic }).eq('id', subscriptionId)
      if (error) console.error('startMpSubscription: failed to persist checkout error', subscriptionId, error.code)
    } catch {
      console.error('startMpSubscription: failed to persist checkout error', subscriptionId)
    }
    // A valid provider authorization must not be presented as a failed charge.
    // Re-fetching reconciles the row through its external reference.
    if (withCard && providerId && ['authorized', 'pending'].includes(providerStatus ?? '')) {
      const status = await syncPreapprovalById(providerId)
      return { error: null, invalid: [], values: {}, subscription: { id: providerId, status: status === 'active' ? 'active' : 'pending' } }
    }
    if (withCard) {
      const message = diagnostic.message.toLowerCase()
      return { ...unavailable, paymentError: /insufficient|fund/.test(message) ? 'funds' : /card|cc_val/.test(message) ? 'card' : 'rejected' }
    }
    return unavailable
  }
  if (withCard && providerId) {
    const status = await syncPreapprovalById(providerId)
    await trackServer('store_checkout_start', null)
    return { error: null, invalid: [], values: {}, subscription: { id: providerId, status: status === 'active' ? 'active' : 'pending' } }
  }
  if (!initPoint) return unavailable

  await trackServer('store_checkout_start', null)
  redirect(initPoint)
}
