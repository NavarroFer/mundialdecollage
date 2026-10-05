// A payment provider, as the rest of the site sees it (a strategy per
// provider): it opens a hosted checkout and, later, says what happened to a
// payment, in the provider's own words translated to ours. What is being
// paid for never depends on which provider took the money — that's
// lib/payments/purchases.ts.
//
// Mercado Pago (lib/payments/providers/mercadopago.ts) is the only one taking
// one-time payments today. PayPal for the extra obras (ROADMAP 4b) would be a
// second implementation, with its Orders API's redirect flow. The store's
// PayPal buttons and subscriptions are a different flow and stay in
// lib/payments/paypal.

export type ProviderId = 'mercadopago' | 'paypal'

/** A payment as the provider itself reported it (re-fetched, never a webhook body). */
export type ProviderPayment = {
  provider: ProviderId
  id: string
  /**
   * approved: the money is in; rejected: it won't be; refunded: it was given
   * back (a refund or a chargeback); pending: anything still in between.
   */
  status: 'approved' | 'pending' | 'rejected' | 'refunded'
  amount: number
  currency: string
  /** What it paid for (lib/payments/references.ts). */
  reference: string | null
}

export type CheckoutItem = { id: string; title: string; quantity: number; unitPrice: number; currency: 'ARS' | 'USD' }

export type CheckoutRequest = {
  /** lib/payments/references.ts */
  reference: string
  items: CheckoutItem[]
  payer: { email: string; name?: string | null }
  /** Where the buyer comes back to, by how the payment went. */
  returnUrls: { success: string; pending: string; failure: string }
}

export type Checkout = {
  /** The provider's page to send the buyer to. */
  url: string
  /** The provider's id for this checkout, kept on the purchase row. */
  id: string | null
}

export interface PaymentProvider {
  id: ProviderId
  isConfigured: boolean
  /** Throws when the provider refuses it. */
  createCheckout(request: CheckoutRequest): Promise<Checkout>
  /** Null for an id that can't be one of this provider's; throws when the provider fails. */
  fetchPayment(paymentId: string): Promise<ProviderPayment | null>
}
