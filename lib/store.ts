export type SubscriptionPlan = {
  id: 'inicial' | 'miembro' | 'socio-premium'
  priceUsd: number
  featured?: boolean
}

// The PayPal plan IDs live in environment variables. Prices are configured in
// PayPal too; these are the public display prices using the agreed ARS 1,000
// = USD 1 conversion, rounded for the three monthly editions.
export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'inicial',
    priceUsd: 10,
  },
  {
    id: 'miembro',
    priceUsd: 36,
    featured: true,
  },
  {
    id: 'socio-premium',
    priceUsd: 82,
  },
]

export function formatUsd(amount: number, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}
