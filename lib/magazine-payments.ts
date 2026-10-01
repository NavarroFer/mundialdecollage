import { Payment } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { entryPaymentOutcome, parseExternalReference, type EntryPurchaseStatus } from '@/lib/entries'

type MercadoPagoPayment = Awaited<ReturnType<Payment['get']>>

// Applies a payment Mercado Pago itself returned (never a webhook body) to
// the magazine order it references — same rules as lib/entry-payments.ts:
// shared by the webhook and by /revista/gracias, and idempotent.
export async function applyMagazinePayment(payment: MercadoPagoPayment): Promise<EntryPurchaseStatus | null> {
  const reference = parseExternalReference(payment.external_reference)
  if (reference?.kind !== 'magazine') return null

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('magazine_orders')
    .select('id, status, amount, currency, mp_payment_id')
    .eq('id', reference.id)
    .maybeSingle()
  if (!order) {
    console.warn('magazine payment: no order found for', reference.id)
    return null
  }

  const outcome = entryPaymentOutcome(payment, order)
  if (outcome === 'mismatch') {
    console.error('magazine payment: amount or currency does not match the order', {
      order: order.id,
      payment: payment.id,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    })
    return order.status
  }
  if (outcome === order.status && (outcome !== 'pending' || order.mp_payment_id === String(payment.id))) {
    return outcome
  }

  const update: Record<string, unknown> = { status: outcome, mp_payment_id: String(payment.id) }
  if (outcome === 'paid') update.paid_at = new Date().toISOString()

  const { error } = await admin.from('magazine_orders').update(update).eq('id', order.id)
  if (error) {
    console.error('magazine payment: failed to update order', order.id, error)
    return order.status
  }
  return outcome
}

export async function syncMagazinePaymentById(paymentId: string) {
  if (!isMercadoPagoConfigured || !/^\d+$/.test(paymentId)) return null
  try {
    const payment = await new Payment(getMercadoPagoConfig()).get({ id: paymentId })
    return await applyMagazinePayment(payment)
  } catch (err) {
    console.error('magazine payment: failed to fetch payment', paymentId, err)
    return null
  }
}
