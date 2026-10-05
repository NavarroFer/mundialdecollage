import { Payment, Preference } from 'mercadopago'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { getSiteUrl } from '@/lib/site'
import type { PaymentProvider, ProviderPayment } from '@/lib/payments/provider'

// Mercado Pago behind the PaymentProvider interface: Checkout Pro
// preferences to pay, and its Payment API to read what happened. Its
// notifications arrive at app/api/mercadopago/webhook.

type MercadoPagoPayment = Awaited<ReturnType<Payment['get']>>

const STATUSES: Record<string, ProviderPayment['status']> = {
  approved: 'approved',
  refunded: 'refunded',
  charged_back: 'refunded',
  rejected: 'rejected',
  cancelled: 'rejected',
}

/** Mercado Pago's payment in our terms; every status it doesn't settle on reads as pending. */
export function fromMercadoPagoPayment(
  payment: Pick<MercadoPagoPayment, 'id' | 'status' | 'transaction_amount' | 'currency_id' | 'external_reference'>,
): ProviderPayment {
  return {
    provider: 'mercadopago',
    id: String(payment.id ?? ''),
    status: STATUSES[payment.status ?? ''] ?? 'pending',
    amount: payment.transaction_amount ?? 0,
    currency: payment.currency_id ?? '',
    reference: payment.external_reference ?? null,
  }
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
        payer: { email: payer.email, name: payer.name ?? undefined },
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
