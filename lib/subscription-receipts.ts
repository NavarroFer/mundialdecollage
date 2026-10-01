// «¡Bienvenida al club!» (compra_suscripcion), once a subscription becomes
// active — PayPal's ACTIVATED webhook (lib/payments/paypal/handlers.ts) or a
// Mercado Pago preapproval turning authorized (lib/mp-subscriptions.ts).
import { formatAddress, formatMoney, localeFromCountry, sendReceiptOnce } from '@/lib/receipts'
import { paypalPlanId, type PaypalPlanKey } from '@/lib/payments/paypal/plans'
import { planById, subscriptionPlans } from '@/lib/store'
import { MESSAGES } from '@/lib/i18n/messages'

/** Mercado Pago subscriptions store their plan as "mp:<plan id>". */
export const mpPlanId = (planId: string) => `mp:${planId}`

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
    const total = charge ? formatMoney(charge.amount, charge.currency, locale) : '—'
    return {
      to: customer.email,
      name: customer.full_name,
      locale,
      tags: { plan: planName, total, direccion: formatAddress(address, locale) },
      summary: `Suscripción ${planName} · ${total}/mes · ${customer.full_name}`,
    }
  })
}
