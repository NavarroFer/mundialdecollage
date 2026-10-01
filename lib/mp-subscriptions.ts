// Store subscriptions in Argentina: a Mercado Pago preapproval in pesos
// (started in app/tienda/actions.ts). Mercado Pago notifies the webhook of
// the preapproval's status changes and of each monthly charge
// ("authorized payment"); both are re-fetched from its API, never trusted
// from the notification body.
import { PreApproval } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { parseExternalReference } from '@/lib/entries'
import { sendSubscriptionReceipt } from '@/lib/subscription-receipts'

type SubscriptionStatus = 'pending' | 'active' | 'suspended' | 'cancelled'

const STATUSES: Record<string, SubscriptionStatus> = {
  pending: 'pending',
  authorized: 'active',
  paused: 'suspended',
  cancelled: 'cancelled',
}

/** Our status for a preapproval's, or null for one we don't track. */
export function subscriptionStatusFor(preapprovalStatus: string | null | undefined): SubscriptionStatus | null {
  return STATUSES[preapprovalStatus ?? ''] ?? null
}

/** Applies a preapproval's current state to the local subscription. */
export async function syncPreapprovalById(preapprovalId: string): Promise<SubscriptionStatus | null> {
  if (!isMercadoPagoConfigured || !/^[a-zA-Z0-9-]{6,80}$/.test(preapprovalId)) return null
  try {
    const preapproval = await new PreApproval(getMercadoPagoConfig()).get({ id: preapprovalId })
    const reference = parseExternalReference(preapproval.external_reference)
    const status = subscriptionStatusFor(preapproval.status)
    if (reference?.kind !== 'subscription' || !status) return null

    const update: Record<string, unknown> = {
      status,
      provider_subscription_id: preapproval.id,
      updated_at: new Date().toISOString(),
    }
    if (preapproval.next_payment_date) update.next_billing_at = preapproval.next_payment_date
    const { data, error } = await createAdminClient()
      .from('subscriptions')
      .update(update)
      .eq('id', reference.id)
      .eq('provider', 'mercadopago')
      .select('id')
    if (error) throw new Error(error.message)
    if (status === 'active' && data?.length) await sendSubscriptionReceipt(reference.id)
    return status
  } catch (err) {
    console.error('mp subscription: failed to sync preapproval', preapprovalId, err)
    return null
  }
}

type AuthorizedPayment = {
  id?: number | string
  preapproval_id?: string
  transaction_amount?: number
  currency_id?: string
  payment?: { id?: number | string; status?: string }
}

/** Records one monthly charge (and its shipment) once Mercado Pago approved it. */
export async function recordAuthorizedPayment(authorizedPaymentId: string) {
  if (!isMercadoPagoConfigured || !/^\d+$/.test(authorizedPaymentId)) return
  try {
    // Not in the SDK: the REST endpoint, with the same access token.
    const response = await fetch(`https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Mercado Pago respondió ${response.status}`)
    const charge = (await response.json()) as AuthorizedPayment
    if (charge.payment?.status !== 'approved' || !charge.payment.id || !charge.preapproval_id) return
    const { error } = await createAdminClient().rpc('record_subscription_payment', {
      p_provider: 'mercadopago',
      p_payment_id: String(charge.payment.id),
      p_subscription_provider_id: charge.preapproval_id,
      p_amount: charge.transaction_amount ?? 0,
      p_fee: null,
      p_currency: charge.currency_id ?? 'ARS',
    })
    if (error) throw new Error(error.message)
  } catch (err) {
    console.error('mp subscription: failed to record charge', authorizedPaymentId, err)
  }
}
