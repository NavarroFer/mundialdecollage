import { isPayPalServerConfigured, paypal } from '@/lib/payments/paypal/client'
import { getSiteUrl, site } from '@/lib/site'
import type { PaymentProvider, ProviderPayment } from '@/lib/payments/provider'

// PayPal behind the PaymentProvider interface: its Orders API's redirect
// flow, with no script of PayPal's on our pages. The buyer approves on
// PayPal and comes back to app/api/paypal/return, which takes the money
// (capturePayPalOrder) and sends them on to the return URL for how it went.
// The store's PayPal buttons and subscriptions are lib/payments/paypal.

type PayPalCapture = { id?: string; status?: string; custom_id?: string; amount?: { value?: string; currency_code?: string } }
type PayPalOrder = {
  id: string
  status?: string
  links?: { href: string; rel: string }[]
  purchase_units?: { payments?: { captures?: PayPalCapture[] } }[]
}

const STATUSES: Record<string, ProviderPayment['status']> = {
  COMPLETED: 'approved',
  REFUNDED: 'refunded',
  DECLINED: 'rejected',
  FAILED: 'rejected',
}

// PayPal's order and capture ids: letters and digits, nothing that could
// change the API path they go into.
const PAYPAL_ID = /^[A-Z0-9]{8,36}$/

const money = (amount: number) => amount.toFixed(2)

/** PayPal's capture in our terms; every status it doesn't settle on reads as pending. */
export function fromPayPalCapture(capture: PayPalCapture): ProviderPayment {
  return {
    provider: 'paypal',
    id: capture.id ?? '',
    status: STATUSES[capture.status ?? ''] ?? 'pending',
    amount: Number(capture.amount?.value ?? 0),
    currency: capture.amount?.currency_code ?? '',
    reference: capture.custom_id ?? null,
  }
}

export const payPal: PaymentProvider = {
  id: 'paypal',
  isConfigured: isPayPalServerConfigured,

  async createCheckout({ reference, items, payer, returnUrls }) {
    const currency = items[0]?.currency
    if (!currency || items.some((item) => item.currency !== currency)) throw new Error('A PayPal checkout takes its items in one currency')
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    // Both ways back go through our route: approving needs the capture, and
    // a redirect from there keeps the #fragment PayPal's query would break.
    const back = new URL('/api/paypal/return', getSiteUrl())
    for (const [outcome, url] of Object.entries(returnUrls)) back.searchParams.set(outcome, url)
    const cancel = new URL(back)
    cancel.searchParams.set('cancel', '1')

    const order = await paypal<PayPalOrder>('/v2/checkout/orders', {
      method: 'POST',
      requestId: `checkout-${reference}`,
      body: {
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: reference,
          description: items[0].title.slice(0, 127),
          amount: { currency_code: currency, value: money(total), breakdown: { item_total: { currency_code: currency, value: money(total) } } },
          items: items.map((item) => ({ name: item.title.slice(0, 127), sku: item.id.slice(0, 127), quantity: String(item.quantity), unit_amount: { currency_code: currency, value: money(item.unitPrice) } })),
        }],
        payment_source: {
          paypal: {
            ...(payer ? { email_address: payer.email } : {}),
            experience_context: { brand_name: site.shortName, shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', return_url: back.toString(), cancel_url: cancel.toString() },
          },
        },
      },
    })
    const url = order.links?.find((link) => link.rel === 'payer-action')?.href
    if (!url) throw new Error('PayPal did not return a checkout URL')
    return { url, id: order.id }
  },

  async fetchPayment(paymentId) {
    if (!isPayPalServerConfigured || !PAYPAL_ID.test(paymentId)) return null
    return fromPayPalCapture(await paypal<PayPalCapture>(`/v2/payments/captures/${paymentId}`))
  },
}

/**
 * Takes the money of an order the buyer approved on PayPal. Safe to repeat:
 * a reload of the way back gets the first answer again.
 */
export async function capturePayPalOrder(orderId: string): Promise<ProviderPayment['status']> {
  if (!isPayPalServerConfigured || !PAYPAL_ID.test(orderId)) return 'rejected'
  try {
    const order = await paypal<PayPalOrder>(`/v2/checkout/orders/${orderId}/capture`, { method: 'POST', requestId: `capture-${orderId}` })
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0]
    return capture ? fromPayPalCapture(capture).status : 'rejected'
  } catch (error) {
    const causes = (error as { causes?: { code?: string }[] }).causes ?? []
    if (causes.some((cause) => cause.code === 'ORDER_ALREADY_CAPTURED')) return 'approved'
    console.error('paypal capture failed', orderId, error instanceof Error ? error.message : error, causes)
    return 'rejected'
  }
}
