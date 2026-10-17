import type { SupabaseClient } from '@supabase/supabase-js'

// What came in, by what it paid for: donations, extra obras, the store and
// the magazine, each from its own table and brought to one shape so
// /admin/estadisticas adds them up alike. Pesos and dollars are never added
// together.

export type IncomePayment = { amount: number | string; currency: string; paidAt: string | null }

export type IncomeSummary = {
  count: number
  /** How many came in since the start of the period. */
  recentCount: number
  /** One total per currency, pesos first. */
  totals: { currency: string; amount: number }[]
}

const CURRENCY_ORDER = ['ARS', 'USD']
const currencyRank = (currency: string) => {
  const index = CURRENCY_ORDER.indexOf(currency)
  return index === -1 ? CURRENCY_ORDER.length : index
}

export function summarizeIncome(payments: IncomePayment[], since: Date): IncomeSummary {
  const totals = new Map<string, number>()
  let recentCount = 0
  for (const payment of payments) {
    totals.set(payment.currency, (totals.get(payment.currency) ?? 0) + Number(payment.amount))
    if (payment.paidAt && new Date(payment.paidAt) >= since) recentCount++
  }
  return {
    count: payments.length,
    recentCount,
    totals: [...totals]
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => currencyRank(a.currency) - currencyRank(b.currency) || a.currency.localeCompare(b.currency)),
  }
}

export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

/** «$ 30.000 + US$ 10», or «$ 0» with nothing in. */
export function formatTotals(totals: IncomeSummary['totals']) {
  return totals.length ? totals.map(({ amount, currency }) => formatAmount(amount, currency)).join(' + ') : formatAmount(0, 'ARS')
}

export type DonationRow = {
  id: string
  provider: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  amount: number | string
  currency: string
  payer_email: string | null
  payer_name: string | null
  created_at: string
  paid_at: string | null
}

export type Income = {
  /** Every donation, newest first, whatever its status (lib/donation-payments.ts). */
  donations: DonationRow[]
  /** What was paid, by what it paid for. */
  paid: Record<'donations' | 'entries' | 'store' | 'magazine', IncomePayment[]>
  activeSubscriptions: number
}

type PaidRow = { amount: number | string; currency: string; paid_at: string | null }
const payments = (rows: PaidRow[]): IncomePayment[] => rows.map(({ amount, currency, paid_at }) => ({ amount, currency, paidAt: paid_at }))

/**
 * Reads it all with the admin's session (each table lets only admins read
 * every row). Null when any of it fails, so no total is ever shown short.
 */
export async function loadIncome(supabase: SupabaseClient): Promise<Income | null> {
  const [donations, entries, store, subscriptions, magazine] = await Promise.all([
    supabase.from('donations')
      .select('id, provider, status, amount, currency, payer_email, payer_name, created_at, paid_at')
      .order('created_at', { ascending: false }),
    supabase.from('entry_purchases').select('amount, currency, paid_at').eq('status', 'paid'),
    // The store's monthly charges and its one-time orders.
    supabase.from('payments').select('amount, currency, paid_at').eq('status', 'completed'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('magazine_orders').select('amount, currency, paid_at').eq('status', 'paid'),
  ])
  const error = donations.error ?? entries.error ?? store.error ?? subscriptions.error ?? magazine.error
  if (error) {
    console.error('income: failed to load', error)
    return null
  }
  const donationRows = (donations.data ?? []) as DonationRow[]
  return {
    donations: donationRows,
    paid: {
      donations: payments(donationRows.filter((row) => row.status === 'paid')),
      entries: payments(entries.data ?? []),
      store: payments(store.data ?? []),
      magazine: payments(magazine.data ?? []),
    },
    activeSubscriptions: subscriptions.count ?? 0,
  }
}
