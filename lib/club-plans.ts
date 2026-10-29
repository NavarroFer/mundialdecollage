import { paypalPlanId } from '@/lib/payments/paypal/plans'

/**
 * Whether a subscription's provider_plan_id is a Club plan. Mercado Pago
 * stores "mp:<plan id>"; PayPal stores the id of the plan created in its
 * dashboard (scripts/paypal-setup.mjs club), which only the environment knows.
 * The store's receipts and shipments are for the other plans only.
 */
export function isClubProviderPlan(providerPlanId: string | null | undefined): boolean {
  if (!providerPlanId) return false
  if (providerPlanId.startsWith('mp:club-')) return true
  return [paypalPlanId('club-monthly'), paypalPlanId('club-annual')].some((planId) => Boolean(planId) && planId === providerPlanId)
}
