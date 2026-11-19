import { clubPlanForProviderPlan } from '@/lib/club-plans'
import { formatMoney } from '@/lib/receipts'
import { planForProviderPlan } from '@/lib/subscription-receipts'
import { storePlanName } from '@/lib/store'
import { MESSAGES } from '@/lib/i18n/messages'

/** Friendly plan name for the admin tables; falls back to the raw provider id. */
export function providerPlanLabel(providerPlanId: string): string {
  const club = clubPlanForProviderPlan(providerPlanId)
  if (club) {
    const price = club.currency === 'USD' ? club.plan.priceUsd : club.plan.priceArs
    return `Club ${club.plan.billing === 'annual' ? 'anual' : 'mensual'} · ${formatMoney(price, club.currency)}`
  }
  const charge = planForProviderPlan(providerPlanId)
  return charge ? storePlanName(charge.plan, MESSAGES.es.store) : providerPlanId
}
