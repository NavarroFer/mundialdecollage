import { applyPayment } from '@/lib/payments/apply'
import { searchMercadoPagoPayments } from '@/lib/payments/providers/mercadopago'
import { parseExternalReference } from '@/lib/payments/references'
import { recoverMercadoPagoSubscriptions } from '@/lib/mp-subscriptions'

// «Buscar en Mercado Pago» (/admin/estadisticas, Pagos): what Mercado Pago's
// notifications should have left behind and didn't, because one never
// arrived or the webhook turned it away. Every payment it took since the site
// started charging is applied as its notification would have been, and every
// store subscription is brought up to date with its monthly charges. Each
// step only writes what changed, so it's safe to repeat.

// The first payments in pesos: the extra obras.
export const MERCADO_PAGO_START = '2026-09-26T00:00:00.000-03:00'

// What it brings back, by the reference's prefix. The taller's bare
// references are left out: the account also takes other businesses'
// payments, and a bare reference can't tell them apart.
const RECOVERED = ['donation', 'entry', 'magazine'] as const
type RecoveredKind = (typeof RECOVERED)[number]

export type Recovered = Record<RecoveredKind, number> & { subscriptions: number; charges: number }

const isRecovered = (kind: string | undefined): kind is RecoveredKind => (RECOVERED as readonly string[]).includes(kind ?? '')

export async function recoverMercadoPago(): Promise<Recovered> {
  const found = { donation: 0, entry: 0, magazine: 0 }
  for (const payment of await searchMercadoPagoPayments(MERCADO_PAGO_START)) {
    const kind = parseExternalReference(payment.reference)?.kind
    if (!isRecovered(kind)) continue
    found[kind]++
    await applyPayment(payment, kind)
  }
  return { ...found, ...(await recoverMercadoPagoSubscriptions()) }
}
