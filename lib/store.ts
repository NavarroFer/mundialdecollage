import type { Messages } from '@/lib/i18n/messages/es'

export type SubscriptionPlan = {
  id: 'inicial' | 'miembro' | 'socio-premium'
  priceUsd: number
  // Charged monthly in Argentina through Mercado Pago (lib/mp-subscriptions.ts).
  priceArs: number
  featured?: boolean
}

// Argentina pays in pesos with Mercado Pago; everywhere else in dollars with
// PayPal. The PayPal plan IDs live in environment variables and its prices
// are configured in PayPal too; priceArs is what Mercado Pago charges each
// month, using the agreed ARS 1,000 = USD 1 conversion.
export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'inicial',
    priceUsd: 15,
    priceArs: 15000,
  },
  {
    id: 'miembro',
    priceUsd: 36,
    priceArs: 36000,
    featured: true,
  },
  {
    id: 'socio-premium',
    priceUsd: 82,
    priceArs: 82000,
  },
]

export function formatUsd(amount: number, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatArs(amount: number, locale = 'es-AR') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
}

// Separate catalogue: existing provider plans remain tied to their original
// products. PayPal sells only the membership; in Argentina, Mercado Pago
// subscribes to either, with the same checkout (/tienda/suscribirme).
export const cutoutPlans = [
  { id: 'recortes-50', count: 50, priceUsd: 15, priceArs: 15000, featured: false },
  { id: 'recortes-100', count: 100, priceUsd: 27, priceArs: 27000, featured: true },
  { id: 'recortes-200', count: 200, priceUsd: 47, priceArs: 47000, featured: false },
] as const

export type CutoutPlan = (typeof cutoutPlans)[number]
/** Anything Mercado Pago can subscribe to: a membership plan or a cutout pack. */
export type StorePlan = SubscriptionPlan | CutoutPlan
export type StorePlanId = StorePlan['id']

export function isCutoutPlan(plan: StorePlan): plan is CutoutPlan {
  return 'count' in plan
}

export function planById(id: string): StorePlan | null {
  return [...subscriptionPlans, ...cutoutPlans].find((plan) => plan.id === id) ?? null
}

/** What the buyer, the receipt and the admin call a plan: «Miembro», «Pack 100 recortes». */
export function storePlanName(plan: StorePlan, copy: Messages['store']) {
  return isCutoutPlan(plan) ? copy.subscriptions.cutoutPlanName.replace('{count}', String(plan.count)) : copy.plans[plan.id].name
}
