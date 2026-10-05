import { createAdminClient } from '@/lib/supabase/admin'
import type { Purchase } from '@/lib/payments/purchases'

// A taller registration (app/taller/actions.ts): one payment, the seña or
// the total. What's left after a seña is settled in person, so it's only
// written down as amount_pending.
export const workshopPurchase: Purchase = {
  async applyPayment(id, payment) {
    const supabase = createAdminClient()
    const { data: registration } = await supabase
      .from('workshop_registrations')
      .select('id, payment_type, amount_total')
      .eq('id', id)
      .maybeSingle()
    if (!registration) {
      console.warn('workshop payment: no registration found for', id)
      return null
    }

    // Unlike the obras and the magazine, a refund isn't handled here: it
    // reads as pending, as it always did.
    let update: Record<string, unknown>
    if (payment.status === 'approved') {
      update = {
        status: 'paid',
        mp_payment_id: payment.id,
        paid_at: new Date().toISOString(),
        amount_paid: payment.amount,
        amount_pending: registration.payment_type === 'sena' ? Math.max(0, registration.amount_total - payment.amount) : 0,
      }
    } else if (payment.status === 'rejected') {
      update = { status: 'failed' }
    } else {
      update = { status: 'pending' }
    }

    const { error } = await supabase.from('workshop_registrations').update(update).eq('id', id)
    if (error) console.error('workshop payment: failed to update registration', id, error)
    return update.status as 'paid' | 'failed' | 'pending'
  },
}
