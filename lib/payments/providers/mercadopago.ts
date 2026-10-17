import { Payment, Preference } from 'mercadopago'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { getSiteUrl } from '@/lib/site'
import type { PaymentProvider, ProviderPayment } from '@/lib/payments/provider'

// Mercado Pago behind the PaymentProvider interface: Checkout Pro
// preferences to pay, and its Payment API to read what happened. Its
// notifications arrive at app/api/mercadopago/webhook.

// What we read of a payment, the same in Payment.get and in a search result.
type MercadoPagoPayment = {
  id?: number | string
  status?: string
  transaction_amount?: number
  currency_id?: string
  external_reference?: string
  date_approved?: string
  payer?: { email?: string; first_name?: string; last_name?: string }
}

const STATUSES: Record<string, ProviderPayment['status']> = {
  approved: 'approved',
  refunded: 'refunded',
  charged_back: 'refunded',
  rejected: 'rejected',
  cancelled: 'rejected',
}

/** Mercado Pago's payment in our terms; every status it doesn't settle on reads as pending. */
export function fromMercadoPagoPayment(payment: MercadoPagoPayment): ProviderPayment {
  const name = [payment.payer?.first_name, payment.payer?.last_name].filter(Boolean).join(' ')
  return {
    provider: 'mercadopago',
    id: String(payment.id ?? ''),
    status: STATUSES[payment.status ?? ''] ?? 'pending',
    amount: payment.transaction_amount ?? 0,
    currency: payment.currency_id ?? '',
    reference: payment.external_reference ?? null,
    paidAt: payment.date_approved ?? undefined,
    payer: payment.payer?.email || name ? { email: payment.payer?.email || null, name: name || null } : undefined,
  }
}

// Mercado Pago's search hands out a page at a time; past this many it stops,
// so a wide range can't keep the request going.
const SEARCH_PAGE = 100
const SEARCH_PAGES = 10

/**
 * Every payment Mercado Pago took since `since` (an ISO date with its
 * offset), newest first: what its notifications would have said, for a
 * payment whose notification was missed or came before we kept it.
 */
export async function searchMercadoPagoPayments(since: string): Promise<ProviderPayment[]> {
  if (!isMercadoPagoConfigured) return []
  const client = new Payment(getMercadoPagoConfig())
  const payments: ProviderPayment[] = []
  for (let page = 0; page < SEARCH_PAGES; page++) {
    const { results = [] } = await client.search({
      options: { range: 'date_created', begin_date: since, end_date: 'NOW', sort: 'date_created', criteria: 'desc', limit: SEARCH_PAGE, offset: page * SEARCH_PAGE },
    })
    payments.push(...results.map(fromMercadoPagoPayment))
    if (results.length < SEARCH_PAGE) break
  }
  return payments
}

export const mercadoPago: PaymentProvider = {
  id: 'mercadopago',
  isConfigured: isMercadoPagoConfigured,

  async createCheckout({ reference, items, payer, returnUrls }) {
    const preference = await new Preference(getMercadoPagoConfig()).create({
      body: {
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency_id: item.currency,
        })),
        payer: payer ? { email: payer.email, name: payer.name ?? undefined } : undefined,
        external_reference: reference,
        back_urls: returnUrls,
        auto_return: 'approved',
        notification_url: `${getSiteUrl()}/api/mercadopago/webhook`,
      },
    })
    if (!preference.init_point) throw new Error('Mercado Pago did not return a checkout URL')
    return { url: preference.init_point, id: preference.id ?? null }
  },

  async fetchPayment(paymentId) {
    if (!isMercadoPagoConfigured || !/^\d+$/.test(paymentId)) return null
    return fromMercadoPagoPayment(await new Payment(getMercadoPagoConfig()).get({ id: paymentId }))
  },
}
