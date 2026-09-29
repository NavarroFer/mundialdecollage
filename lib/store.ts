export type SubscriptionPlan = {
  name: string
  priceArs: number
  checkoutUrl: string
  contents: string[]
  description: string
  featured?: boolean
}

// Hosted Mercado Pago subscription links. Keep prices server-owned here: the
// checkout itself is Mercado Pago, so a visitor never supplies an amount.
export const subscriptionPlans: SubscriptionPlan[] = [
  {
    name: 'Inicial',
    priceArs: 10700,
    checkoutUrl: 'https://mpago.la/1cPc3n9',
    description: 'A small monthly dose of paper, images and good scissors energy.',
    contents: ['A6 notebook · 20 sheets · 90g', '2 A5 prints', '2 Mundial de Collage stickers', '1 postcard'],
  },
  {
    name: 'Miembro',
    priceArs: 36700,
    checkoutUrl: 'https://mpago.la/1JfCJgX',
    description: 'A full collage session, delivered to your door every month.',
    contents: ['A6 notebook · 40 sheets · 90g', '1 fanzine', '2 A5 illustrations', 'Sticker sheet, postcard and collage kit'],
    featured: true,
  },
  {
    name: 'Socio Premium',
    priceArs: 82700,
    checkoutUrl: 'https://mpago.la/249e5VN',
    description: 'The complete monthly edition for serious paper collectors.',
    contents: ['A5 notebook · 40 sheets · 120g', '2 original fanzines', '2 A5 illustrations + 1 A4 illustration', '2 bookmarks, A4 sticker sheet and super collage kit'],
  },
]

export function formatArs(amount: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount)
}
