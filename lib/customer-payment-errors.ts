import { createAdminClient } from '@/lib/supabase/admin'
import { subscriptionCheckoutError } from '@/lib/subscription-checkout-error'

export type PaymentErrorStage = 'create_subscription' | 'create_preapproval' | 'save_preapproval' | 'checkout_url' | 'sync_subscription' | 'recurring_payment' | 'record_payment'

// Append-only history. Diagnostics must never make checkout itself fail.
export async function recordCustomerPaymentError(input: {
  provider?: 'mercadopago' | 'paypal'
  customerId?: string
  subscriptionId?: string
  providerSubscriptionId?: string
  eventKey?: string
  stage: PaymentErrorStage
  error: unknown
}) {
  try {
    const admin = createAdminClient()
    let customerId = input.customerId
    let subscriptionId = input.subscriptionId
    if (!customerId && (subscriptionId || input.providerSubscriptionId)) {
      let query = admin.from('subscriptions').select('id, customer_id')
      query = query.eq('provider', input.provider ?? 'mercadopago')
      query = subscriptionId ? query.eq('id', subscriptionId) : query.eq('provider_subscription_id', input.providerSubscriptionId!)
      const { data, error } = await query.maybeSingle()
      if (error) throw new Error('Unable to resolve payment customer')
      customerId = data?.customer_id
      subscriptionId = data?.id
    }
    if (!customerId) return
    const diagnostic = subscriptionCheckoutError(input.stage, input.error)
    const { error } = await admin.from('customer_payment_errors').upsert({
      customer_id: customerId,
      subscription_id: subscriptionId ?? null,
      provider: input.provider ?? 'mercadopago',
      event_key: input.eventKey ?? null,
      stage: input.stage,
      http_status: diagnostic.status ?? null,
      message: diagnostic.message,
      codes: diagnostic.codes,
    }, { onConflict: 'event_key', ignoreDuplicates: true })
    if (error) console.error('payment error history: failed to persist', error.code)
  } catch {
    console.error('payment error history: failed to persist')
  }
}
