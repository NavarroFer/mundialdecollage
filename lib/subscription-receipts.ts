// «¡Bienvenida al club!» (compra_suscripcion), once a subscription becomes
// active — from PayPal's ACTIVATED webhook (lib/payments/paypal/handlers.ts).
import { formatAddress, formatMoney, localeFromCountry, sendReceiptOnce } from '@/lib/receipts'
import { paypalPlanId, type PaypalPlanKey } from '@/lib/payments/paypal/plans'
import { subscriptionPlans } from '@/lib/store'
import { MESSAGES } from '@/lib/i18n/messages'

/** The store plan behind a subscription's provider plan id. */
export function planForProviderPlan(providerPlanId: string) {
  return subscriptionPlans.find((plan) => paypalPlanId(plan.id as PaypalPlanKey) === providerPlanId) ?? null
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
    const plan = planForProviderPlan(subscription.provider_plan_id)
    const planName = plan ? MESSAGES[locale].store.plans[plan.id].name : subscription.provider_plan_id
    const total = plan ? formatMoney(plan.priceUsd, 'USD', locale) : '—'
    return {
      to: customer.email,
      name: customer.full_name,
      locale,
      tags: { plan: planName, total, direccion: formatAddress(address, locale) },
      summary: `Suscripción ${planName} · ${total}/mes · ${customer.full_name}`,
    }
  })
}
