import { entryPurchase } from '@/lib/entry-payments'
import { magazinePurchase } from '@/lib/magazine-payments'
import { workshopPurchase } from '@/lib/workshop-payments'
import type { PaymentProvider, ProviderPayment } from '@/lib/payments/provider'
import type { Purchase, PurchaseStatus } from '@/lib/payments/purchases'
import { parseExternalReference, type ReferenceKind } from '@/lib/payments/references'

// Which purchase a one-time payment is for, by its reference. A store
// subscription's monthly charge isn't here: it's recorded from its
// authorized payment (lib/mp-subscriptions.ts).
const PURCHASES = {
  entry: entryPurchase,
  magazine: magazinePurchase,
  workshop: workshopPurchase,
} satisfies Partial<Record<ReferenceKind, Purchase>>

export type OneTimePurchaseKind = keyof typeof PURCHASES

/**
 * Applies a payment to the purchase its reference points at. `only` limits
 * it to one kind: a return page applies the payment it's handed only if
 * it's for what that page sells.
 */
export async function applyPayment(payment: ProviderPayment, only?: OneTimePurchaseKind): Promise<PurchaseStatus | null> {
  const reference = parseExternalReference(payment.reference)
  if (!reference) {
    console.warn(`payments: ${payment.provider} payment has no reference`, payment.id)
    return null
  }
  if (!Object.hasOwn(PURCHASES, reference.kind)) return null
  const kind = reference.kind as OneTimePurchaseKind
  if (only && kind !== only) return null
  return PURCHASES[kind].applyPayment(reference.id, payment)
}

/** Re-fetches a payment from its provider and applies it. Never throws. */
export async function syncPayment(provider: PaymentProvider, paymentId: string, only?: OneTimePurchaseKind): Promise<PurchaseStatus | null> {
  if (!provider.isConfigured) return null
  let payment: ProviderPayment | null
  try {
    payment = await provider.fetchPayment(paymentId)
  } catch (err) {
    console.error(`payments: failed to fetch ${provider.id} payment`, paymentId, err)
    return null
  }
  return payment ? applyPayment(payment, only) : null
}
