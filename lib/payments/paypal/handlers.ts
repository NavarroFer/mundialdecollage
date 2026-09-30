import { createAdminClient } from '@/lib/supabase/admin'

type PaypalEvent = { event_type: string; resource: Record<string, unknown> }

const subscriptionStatuses: Record<string, string> = {
  'BILLING.SUBSCRIPTION.ACTIVATED': 'active',
  'BILLING.SUBSCRIPTION.CANCELLED': 'cancelled',
  'BILLING.SUBSCRIPTION.SUSPENDED': 'suspended',
  'BILLING.SUBSCRIPTION.EXPIRED': 'expired',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED': 'past_due',
}

const text = (value: unknown) => (typeof value === 'string' ? value : undefined)
const number = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? Number(value) : undefined)

export async function handlePaypalEvent(event: PaypalEvent) {
  const resource = event.resource
  const supabase = createAdminClient()

  if (event.event_type in subscriptionStatuses || event.event_type === 'BILLING.SUBSCRIPTION.UPDATED') {
    const subscriptionId = text(resource.id)
    if (!subscriptionId) throw new Error('PayPal subscription event did not include an id')
    const billingInfo = resource.billing_info as Record<string, unknown> | undefined
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (subscriptionStatuses[event.event_type]) update.status = subscriptionStatuses[event.event_type]
    if (text(billingInfo?.next_billing_time)) update.next_billing_at = text(billingInfo?.next_billing_time)
    const { error } = await supabase.from('subscriptions').update(update).eq('provider_subscription_id', subscriptionId)
    if (error) throw new Error(`Could not update subscription: ${error.message}`)
    return
  }

  if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
    const agreementId = text(resource.billing_agreement_id)
    const paymentId = text(resource.id)
    const amount = resource.amount as Record<string, unknown> | undefined
    const fee = resource.transaction_fee as Record<string, unknown> | undefined
    if (!agreementId || !paymentId || number(amount?.total) === undefined || !text(amount?.currency)) {
      throw new Error('PayPal sale event is missing payment data')
    }
    const { error } = await supabase.rpc('record_paypal_subscription_payment', {
      p_payment_id: paymentId,
      p_subscription_provider_id: agreementId,
      p_amount: number(amount?.total),
      p_fee: number(fee?.value) ?? null,
      p_currency: text(amount?.currency),
    })
    if (error) throw new Error(`Could not record subscription payment: ${error.message}`)
    return
  }

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const supplementary = resource.supplementary_data as Record<string, unknown> | undefined
    const related = supplementary?.related_ids as Record<string, unknown> | undefined
    await recordOneTimeCapture(resource, text(related?.order_id))
    return
  }

  if (event.event_type === 'PAYMENT.SALE.REFUNDED' || event.event_type === 'PAYMENT.SALE.REVERSED') {
    await markPaymentReversed(text(resource.sale_id) ?? text(resource.id), event.event_type.endsWith('REFUNDED') ? 'refunded' : 'reversed')
    return
  }

  if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED' || event.event_type === 'PAYMENT.CAPTURE.REVERSED') {
    await markPaymentReversed(text(resource.id), event.event_type.endsWith('REFUNDED') ? 'refunded' : 'reversed')
  }
}

export async function recordOneTimeCapture(capture: Record<string, unknown>, providerOrderId?: string) {
  const paymentId = text(capture.id)
  let orderId = text(capture.custom_id)
  const amount = capture.amount as Record<string, unknown> | undefined
  const breakdown = capture.seller_receivable_breakdown as Record<string, unknown> | undefined
  const fee = breakdown?.paypal_fee as Record<string, unknown> | undefined
  if (!orderId && providerOrderId) {
    const { data, error } = await createAdminClient().from('orders').select('id').eq('provider_order_id', providerOrderId).maybeSingle()
    if (error) throw new Error(`Could not resolve PayPal order: ${error.message}`)
    orderId = data?.id
  }
  if (!paymentId || !orderId || number(amount?.value) === undefined || !text(amount?.currency_code)) {
    throw new Error('PayPal capture is missing payment data')
  }
  const { error } = await createAdminClient().rpc('record_paypal_order_payment', {
    p_payment_id: paymentId,
    p_order_id: orderId,
    p_amount: number(amount?.value),
    p_fee: number(fee?.value) ?? null,
    p_currency: text(amount?.currency_code),
  })
  if (error) throw new Error(`Could not record order payment: ${error.message}`)
}

async function markPaymentReversed(providerPaymentId: string | undefined, status: 'refunded' | 'reversed') {
  if (!providerPaymentId) throw new Error('PayPal reversal is missing its payment id')
  const supabase = createAdminClient()
  const { data: payment, error } = await supabase
    .from('payments')
    .update({ status })
    .eq('provider_payment_id', providerPaymentId)
    .select('id, order_id')
    .maybeSingle()
  if (error) throw new Error(`Could not reverse payment: ${error.message}`)
  if (!payment) return
  await supabase.from('shipments').update({ status: 'cancelled' }).eq('payment_id', payment.id).eq('status', 'pending')
  if (payment.order_id) await supabase.from('orders').update({ status }).eq('id', payment.order_id)
}
