import { createAdminClient } from '@/lib/supabase/admin'
import type { ProviderPayment } from '@/lib/payments/provider'
import type { Purchase, PurchaseStatus } from '@/lib/payments/purchases'

// A donation (lib/donations.ts) as the payments see it. Nothing is stored
// when the checkout opens: the first payment the provider reports for it
// creates its row in `donations`, and later ones update it. There's no price
// to check a payment against, so whatever was given is the donation.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * What a donation becomes after a payment for it. A paid donation is never
 * taken back to pending or failed (notifications can arrive out of order,
 * or be for an earlier attempt); only a refund or chargeback undoes it.
 */
export function donationStatus(previous: PurchaseStatus | null, payment: Pick<ProviderPayment, 'status'>): PurchaseStatus {
  if (payment.status === 'refunded') return 'refunded'
  if (previous === 'paid' || previous === 'refunded') return previous
  if (payment.status === 'approved') return 'paid'
  if (payment.status === 'rejected') return 'failed'
  return 'pending'
}

// The database and Mercado Pago write the same moment differently.
function sameInstant(stored: string | null | undefined, reported: string | undefined) {
  if (!stored || !reported) return !stored && !reported
  return new Date(stored).getTime() === new Date(reported).getTime()
}

export const donationPurchase: Purchase = {
  async applyPayment(id, payment) {
    if (!UUID.test(id)) {
      console.warn('donation: not a donation id', id)
      return null
    }
    const admin = createAdminClient()
    const { data: previous, error: readError } = await admin
      .from('donations')
      .select('status, provider_payment_id, available_at')
      .eq('id', id)
      .maybeSingle()
    if (readError) {
      console.error('donation: failed to read', id, readError)
      return null
    }

    const status = donationStatus(previous?.status ?? null, payment)
    if (previous && previous.status === status) {
      const same = previous.provider_payment_id === payment.id
      // A stray payment for a donation already settled.
      if (!same && (status === 'paid' || status === 'refunded')) return status
      // The same payment again, with nothing new to say.
      if (same && sameInstant(previous.available_at, payment.availableAt)) return status
    }

    const row: Record<string, unknown> = {
      id,
      provider: payment.provider,
      provider_payment_id: payment.id,
      status,
      amount: payment.amount,
      currency: payment.currency,
    }
    // PayPal's capture doesn't say who paid: what an earlier payment said stays.
    if (payment.payer) Object.assign(row, { payer_email: payment.payer.email, payer_name: payment.payer.name })
    if (payment.availableAt) row.available_at = payment.availableAt
    const when = payment.paidAt ?? new Date().toISOString()
    if (status === 'paid') row.paid_at = when
    if (!previous) row.created_at = when

    const { error } = await admin.from('donations').upsert(row, { onConflict: 'id' })
    if (error) {
      console.error('donation: failed to record', id, payment.id, error)
      return null
    }
    return status
  },
}
