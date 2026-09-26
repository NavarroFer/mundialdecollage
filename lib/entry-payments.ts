import { Payment } from 'mercadopago'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { entryPaymentOutcome, parseExternalReference, type EntryPurchaseStatus } from '@/lib/entries'

// Works with the artist's own session (RLS lets them read their rows) or the
// service-role client.
export async function hasPaidEntries(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('entry_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .limit(1)
  return (data?.length ?? 0) > 0
}

type MercadoPagoPayment = Awaited<ReturnType<Payment['get']>>

// Applies a payment Mercado Pago itself returned (never a webhook body) to
// the obra purchase it references. Shared by the webhook and by the page the
// artist lands on after paying, so the limit goes up even when the webhook
// is late or never arrives. Idempotent: running it twice for the same
// payment changes nothing the second time.
export async function applyEntryPayment(payment: MercadoPagoPayment): Promise<EntryPurchaseStatus | null> {
  const reference = parseExternalReference(payment.external_reference)
  if (reference?.kind !== 'entry') return null

  const admin = createAdminClient()
  const { data: purchase } = await admin
    .from('entry_purchases')
    .select('id, status, amount, currency, mp_payment_id')
    .eq('id', reference.id)
    .maybeSingle()
  if (!purchase) {
    console.warn('entry payment: no purchase found for', reference.id)
    return null
  }

  const outcome = entryPaymentOutcome(payment, purchase)
  if (outcome === 'mismatch') {
    console.error('entry payment: amount or currency does not match the purchase', {
      purchase: purchase.id,
      payment: payment.id,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    })
    return purchase.status
  }
  // A payment still in process is recorded too: its id is what tells the
  // page "your payment is on its way" apart from a checkout left unpaid.
  if (outcome === purchase.status && (outcome !== 'pending' || purchase.mp_payment_id === String(payment.id))) {
    return outcome
  }

  const update: Record<string, unknown> = { status: outcome, mp_payment_id: String(payment.id) }
  if (outcome === 'paid') update.paid_at = new Date().toISOString()

  const { error } = await admin.from('entry_purchases').update(update).eq('id', purchase.id)
  if (error) {
    console.error('entry payment: failed to update purchase', purchase.id, error)
    return purchase.status
  }
  return outcome
}

export async function syncEntryPaymentById(paymentId: string) {
  if (!isMercadoPagoConfigured || !/^\d+$/.test(paymentId)) return null
  try {
    const payment = await new Payment(getMercadoPagoConfig()).get({ id: paymentId })
    return await applyEntryPayment(payment)
  } catch (err) {
    console.error('entry payment: failed to fetch payment', paymentId, err)
    return null
  }
}
