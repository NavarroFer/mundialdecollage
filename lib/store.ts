export type SubscriptionPlan = {
  id: 'inicial' | 'miembro' | 'socio-premium'
  name: string
  priceUsd: number
  contents: string[]
  description: string
  featured?: boolean
}

// The PayPal plan IDs live in environment variables. Prices are configured in
// PayPal too; these are the public display prices using the agreed ARS 1,000
// = USD 1 conversion, rounded for the three monthly editions.
export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'inicial',
    name: 'Inicial',
    priceUsd: 10,
    description: 'A small monthly dose of paper, images and good scissors energy.',
    contents: ['A6 notebook · 20 sheets · 90g', '2 A5 prints', '2 Mundial de Collage stickers', '1 postcard'],
  },
  {
    id: 'miembro',
    name: 'Miembro',
    priceUsd: 36,
    description: 'A full collage session, delivered to your door every month.',
    contents: ['A6 notebook · 40 sheets · 90g', '1 fanzine', '2 A5 illustrations', 'Sticker sheet, postcard and collage kit'],
    featured: true,
  },
  {
    id: 'socio-premium',
    name: 'Socio Premium',
    priceUsd: 82,
    description: 'The complete monthly edition for serious paper collectors.',
    contents: ['A5 notebook · 40 sheets · 120g', '2 original fanzines', '2 A5 illustrations + 1 A4 illustration', '2 bookmarks, A4 sticker sheet and super collage kit'],
  },
]

export function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}
