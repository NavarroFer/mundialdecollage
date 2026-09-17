// Mercado Pago's own cut isn't merchant-adjustable — it's set by account/payment
// type. What IS useful is a "gross-up" helper: given the amount you actually
// want to receive, and MP's fee %, compute what to charge so the fee doesn't
// eat into it. These defaults are Argentina Checkout Pro rates as of 2026-09
// (mercadopago.com.ar/ayuda/33399) — confirm against the real account once
// it's created, rates vary by payment method/installments and can change.
export const MERCADOPAGO_FEE_PRESETS = {
  debit: 3.29,
  creditImmediate: 3.99,
} as const

export type MercadoPagoFeePreset = keyof typeof MERCADOPAGO_FEE_PRESETS

/**
 * Given the net amount you want to end up with after Mercado Pago's fee,
 * returns the gross price to charge the buyer so the fee doesn't cut into it.
 * netAmount=10000, feePercent=3.99 -> ~10415.
 */
export function priceWithFee(netAmount: number, feePercent: number) {
  if (netAmount <= 0 || feePercent < 0) return netAmount
  return Math.round((netAmount / (1 - feePercent / 100)) * 100) / 100
}
