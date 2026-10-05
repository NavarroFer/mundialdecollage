import { createAdminClient } from '@/lib/supabase/admin'
import type { ProviderPayment } from '@/lib/payments/provider'

// What is being paid for, as a strategy per kind of purchase (obras extra,
// the magazine, the taller): how a payment the provider reported changes it.
// Which one applies is decided by the payment's reference
// (lib/payments/apply.ts); none of them depends on the provider.

export type PurchaseStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export type Purchase = {
  /**
   * Applies a payment the provider itself reported (never a webhook body) to
   * the purchase `id`. Shared by the webhook and by the page the buyer comes
   * back to, so it must be idempotent. Returns the purchase's status after,
   * or null when there's no such purchase.
   */
  applyPayment(id: string, payment: ProviderPayment): Promise<PurchaseStatus | null>
}

// What a purchase becomes after a payment for it. Never trusts a payment for
// less than the price or in another currency, and never takes a paid
// purchase back to pending or failed (notifications can arrive out of
// order); only a refund or chargeback undoes it.
export function paymentOutcome(
  payment: Pick<ProviderPayment, 'status' | 'amount' | 'currency'>,
  purchase: { status: PurchaseStatus; amount: number; currency: string },
): PurchaseStatus | 'mismatch' {
  if (payment.status === 'refunded') return purchase.status === 'paid' ? 'refunded' : purchase.status
  if (purchase.status === 'paid' || purchase.status === 'refunded') return purchase.status
  if (payment.status === 'approved') {
    if (payment.currency !== purchase.currency || payment.amount < Number(purchase.amount)) return 'mismatch'
    return 'paid'
  }
  if (payment.status === 'rejected') return 'failed'
  return 'pending'
}

/**
 * A purchase kept as one row with status, amount, currency, mp_payment_id
 * and paid_at (entry_purchases, magazine_orders), with a receipt mailed once
 * it's paid. Both follow the same steps; only the table, the logs' name and
 * the receipt change.
 */
export function rowPurchase({
  table,
  label,
  sendReceipt,
}: {
  table: 'entry_purchases' | 'magazine_orders'
  label: string
  sendReceipt: (id: string) => Promise<unknown>
}): Purchase {
  return {
    async applyPayment(id, payment) {
      const admin = createAdminClient()
      const { data: purchase } = await admin
        .from(table)
        .select('id, status, amount, currency, mp_payment_id')
        .eq('id', id)
        .maybeSingle()
      if (!purchase) {
        console.warn(`${label}: nothing found for`, id)
        return null
      }

      const outcome = paymentOutcome(payment, purchase)
      if (outcome === 'mismatch') {
        console.error(`${label}: amount or currency does not match`, {
          purchase: purchase.id,
          payment: payment.id,
          amount: payment.amount,
          currency: payment.currency,
        })
        return purchase.status
      }
      // A payment still in process is recorded too: its id is what tells the
      // page "your payment is on its way" apart from a checkout left unpaid.
      if (outcome === purchase.status && (outcome !== 'pending' || purchase.mp_payment_id === payment.id)) {
        // Already paid: the receipt may still be owed if its first send failed.
        if (outcome === 'paid') await sendReceipt(purchase.id)
        return outcome
      }

      const update: Record<string, unknown> = { status: outcome, mp_payment_id: payment.id }
      if (outcome === 'paid') update.paid_at = new Date().toISOString()

      const { error } = await admin.from(table).update(update).eq('id', purchase.id)
      if (error) {
        console.error(`${label}: failed to update`, purchase.id, error)
        return purchase.status
      }
      if (outcome === 'paid') await sendReceipt(purchase.id)
      return outcome
    },
  }
}
