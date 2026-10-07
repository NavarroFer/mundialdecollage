// «¡Bienvenida al club!» (compra_suscripcion), once a subscription becomes
// active — PayPal's ACTIVATED webhook (lib/payments/paypal/handlers.ts) or a
// Mercado Pago preapproval turning authorized (lib/mp-subscriptions.ts).
import { formatAddress, formatMoney, localeFromCountry, sendReceiptOnce } from '@/lib/receipts'
import { paypalPlanId, type PaypalPlanKey } from '@/lib/payments/paypal/plans'
import { planById, subscriptionPlans } from '@/lib/store'
import { pickupCopy } from '@/lib/pickup-copy'
import { MESSAGES } from '@/lib/i18n/messages'

/** Mercado Pago subscriptions store their plan as "mp:<plan id>". */
export const mpPlanId = (planId: string) => `mp:${planId}`

export function subscriptionPickupNote(address: Record<string, unknown> | null, locale: Parameters<typeof pickupCopy>[0]) {
  if (address?.country_code !== 'AR') return ''
  if (address.delivery_type !== 'branch') {
    return 'Los envíos dentro de Argentina se retiran en una sucursal de Correo Argentino; no se entregan a domicilio. Respondé este mail para coordinar tu sucursal de retiro antes del despacho.'
  }
  return `Tu envío se retira en la sucursal de Correo Argentino indicada arriba; no se entrega a domicilio. ${pickupCopy(locale).recurring} ${pickupCopy(locale).readyHelp} Para retirar, el destinatario deberá acreditar su identidad. Te informaremos la fecha límite de retiro cuando el paquete esté disponible.`
}

/** The store plan behind a subscription, and the currency it's charged in. */
export function planForProviderPlan(providerPlanId: string) {
  if (providerPlanId.startsWith('mp:')) {
    const plan = planById(providerPlanId.slice(3))
    return plan ? { plan, amount: plan.priceArs, currency: 'ARS' } : null
  }
  const plan = subscriptionPlans.find((candidate) => paypalPlanId(candidate.id as PaypalPlanKey) === providerPlanId)
  return plan ? { plan, amount: plan.priceUsd, currency: 'USD' } : null
}

export function sendSubscriptionReceipt(subscriptionId: string) {
  return sendReceiptOnce('subscriptions', subscriptionId, 'compra_suscripcion', async (db) => {
    const { data: subscription } = await db.from('subscriptions')
      .select('provider_plan_id, shipping_address, customers!inner(email, full_name)')
      .eq('id', subscriptionId)
      .single()
    if (!subscription) return null
    const customer = subscription.customers as unknown as { email: string; full_name: string }
    const address = subscription.shipping_address as Record<string, unknown>
    const locale = localeFromCountry(typeof address?.country_code === 'string' ? address.country_code : null)
    const charge = planForProviderPlan(subscription.provider_plan_id)
    const planName = charge ? MESSAGES[locale].store.plans[charge.plan.id].name : subscription.provider_plan_id
    const billed = typeof address?.billing_amount === 'number' && address.billing_amount > 0 ? address.billing_amount : charge?.amount
    const total = charge && billed ? formatMoney(billed, charge.currency, locale) : '—'
    return {
      to: customer.email,
      name: customer.full_name,
      locale,
      tags: { plan: planName, total, direccion: formatAddress(address, locale), pickup_note: subscriptionPickupNote(address, locale) },
      summary: `Suscripción ${planName} · ${total}/mes · ${customer.full_name}`,
    }
  })
}
