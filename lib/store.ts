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
    priceUsd: 10,
    priceArs: 10000,
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

export function planById(id: string) {
  return subscriptionPlans.find((plan) => plan.id === id) ?? null
}
