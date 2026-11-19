import { paypalPlanId } from '@/lib/payments/paypal/plans'
import { clubMembershipPlanById, clubMembershipPlans, type ClubMembershipPlan } from '@/lib/store'

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

/**
 * The Club plan behind a subscription's provider_plan_id, with the currency it
 * is charged in. Same ids as isClubProviderPlan: "mp:club-*" or the PayPal plan.
 */
export function clubPlanForProviderPlan(providerPlanId: string | null | undefined): { plan: ClubMembershipPlan; currency: 'ARS' | 'USD' } | null {
  if (!providerPlanId) return null
  if (providerPlanId.startsWith('mp:club-')) {
    const plan = clubMembershipPlanById(providerPlanId.slice(3))
    return plan ? { plan, currency: 'ARS' } : null
  }
  const plan = clubMembershipPlans.find((candidate) => {
    const id = paypalPlanId(candidate.id)
    return Boolean(id) && id === providerPlanId
  })
  return plan ? { plan, currency: 'USD' } : null
}
