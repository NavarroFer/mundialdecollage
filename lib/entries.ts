import { site } from '@/lib/site'

// An artist keeps any number of obras (up to site.entries.maxStored) but
// only postulates some of them: one for free, up to paidLimit after the
// one-time payment. The obra that represents them on the public site
// (is_selected) is always one of the postulated ones (is_entered) — see
// supabase/migrations/20260926130000_artwork_entries.sql.

export function entryLimit(hasPaid: boolean) {
  return hasPaid ? site.entries.paidLimit : site.entries.freeLimit
}

// Someone with several obras who never chose is sent to choose first: an
// artist who sent more than one by mail, or uploaded another one.
export function needsEntryChoice(artworkCount: number, entriesChosenAt: string | null | undefined) {
  return artworkCount > 1 && !entriesChosenAt
}

export type EntryChoice =
  | { ok: true; entered: string[]; main: string }
  | { ok: false; error: 'none' | 'too_many' | 'not_owned' }

// Validates what the artist submitted on /onboarding/obras against the obras
// they actually own and their limit. The main obra is the one they marked,
// else the one that already represented them if it's still postulated, else
// the first postulated one.
export function resolveEntryChoice({
  ownedIds,
  requestedIds,
  mainId,
  currentMainId,
  limit,
}: {
  ownedIds: string[]
  requestedIds: string[]
  mainId?: string | null
  currentMainId?: string | null
  limit: number
}): EntryChoice {
  const owned = new Set(ownedIds)
  const entered = [...new Set(requestedIds.filter(Boolean))]
  if (entered.length === 0) return { ok: false, error: 'none' }
  if (entered.some((id) => !owned.has(id))) return { ok: false, error: 'not_owned' }
  if (entered.length > limit) return { ok: false, error: 'too_many' }

  const main =
    mainId && entered.includes(mainId)
      ? mainId
      : currentMainId && entered.includes(currentMainId)
        ? currentMainId
        : entered[0]
  return { ok: true, entered, main }
}

// Mercado Pago's external_reference is shared by every checkout on the site.
// Obra payments carry an "entry:" prefix and magazine orders "revista:"; the
// taller's registrations were created before both and use their bare id.
const ENTRY_PREFIX = 'entry:'
const MAGAZINE_PREFIX = 'revista:'

export function entryExternalReference(purchaseId: string) {
  return `${ENTRY_PREFIX}${purchaseId}`
}

export function magazineExternalReference(orderId: string) {
  return `${MAGAZINE_PREFIX}${orderId}`
}

export function parseExternalReference(
  reference: string | null | undefined,
): { kind: 'entry' | 'magazine' | 'workshop'; id: string } | null {
  if (!reference) return null
  for (const [prefix, kind] of [[ENTRY_PREFIX, 'entry'], [MAGAZINE_PREFIX, 'magazine']] as const) {
    if (!reference.startsWith(prefix)) continue
    const id = reference.slice(prefix.length)
    return id ? { kind, id } : null
  }
  return { kind: 'workshop', id: reference }
}

export type EntryPurchaseStatus = 'pending' | 'paid' | 'failed' | 'refunded'

// What a purchase becomes after Mercado Pago reports a payment for it. Never
// trusts a payment for less than the price or in another currency, and never
// takes a paid purchase back to pending or failed (notifications can arrive
// out of order); only a refund or chargeback undoes it.
export function entryPaymentOutcome(
  payment: { status?: string | null; transaction_amount?: number | null; currency_id?: string | null },
  purchase: { status: EntryPurchaseStatus; amount: number; currency: string },
): EntryPurchaseStatus | 'mismatch' {
  const status = payment.status ?? ''
  if (status === 'refunded' || status === 'charged_back') {
    return purchase.status === 'paid' ? 'refunded' : purchase.status
  }
  if (purchase.status === 'paid' || purchase.status === 'refunded') return purchase.status
  if (status === 'approved') {
    const amount = payment.transaction_amount ?? 0
    if (payment.currency_id !== purchase.currency || amount < Number(purchase.amount)) return 'mismatch'
    return 'paid'
  }
  if (status === 'rejected' || status === 'cancelled') return 'failed'
  return 'pending'
}
