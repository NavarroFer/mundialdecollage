// The external reference every checkout carries so a payment can be traced
// back to what it paid for (Mercado Pago's external_reference). Obra
// payments carry an "entry:" prefix, magazine orders "revista:" and Mercado
// Pago subscriptions "suscripcion:"; the taller's registrations were created
// before all of them and use their bare id.
const ENTRY_PREFIX = 'entry:'
const MAGAZINE_PREFIX = 'revista:'
const SUBSCRIPTION_PREFIX = 'suscripcion:'

export type ReferenceKind = 'entry' | 'magazine' | 'subscription' | 'workshop'

export type PaymentReference = { kind: ReferenceKind; id: string }

export function entryExternalReference(purchaseId: string) {
  return `${ENTRY_PREFIX}${purchaseId}`
}

export function magazineExternalReference(orderId: string) {
  return `${MAGAZINE_PREFIX}${orderId}`
}

export function subscriptionExternalReference(subscriptionId: string) {
  return `${SUBSCRIPTION_PREFIX}${subscriptionId}`
}

export function workshopExternalReference(registrationId: string) {
  return registrationId
}

export function parseExternalReference(reference: string | null | undefined): PaymentReference | null {
  if (!reference) return null
  for (const [prefix, kind] of [[ENTRY_PREFIX, 'entry'], [MAGAZINE_PREFIX, 'magazine'], [SUBSCRIPTION_PREFIX, 'subscription']] as const) {
    if (!reference.startsWith(prefix)) continue
    const id = reference.slice(prefix.length)
    return id ? { kind, id } : null
  }
  return { kind: 'workshop', id: reference }
}
