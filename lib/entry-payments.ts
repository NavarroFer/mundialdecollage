import type { SupabaseClient } from '@supabase/supabase-js'
import { rowPurchase } from '@/lib/payments/purchases'
import { formatMoney, localeFromCountry, sendReceiptOnce } from '@/lib/receipts'

// Works with the artist's own session (RLS lets them read their rows) or the
// service-role client.
export async function hasPaidEntries(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('entry_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .limit(1)
  return (data?.length ?? 0) > 0
}

// The one-time payment to postulate more obras (app/onboarding/obras).
export const entryPurchase = rowPurchase({ table: 'entry_purchases', label: 'entry payment', sendReceipt: sendEntryReceipt })

// «Ya podés postular más obras» (compra_obras).
function sendEntryReceipt(purchaseId: string) {
  return sendReceiptOnce('entry_purchases', purchaseId, 'compra_obras', async (db) => {
    const { data: purchase } = await db.from('entry_purchases')
      .select('user_id, email, amount, currency, entries_allowed')
      .eq('id', purchaseId)
      .single()
    if (!purchase) return null
    const { data: profile } = await db.from('profiles').select('name, country_code').eq('id', purchase.user_id).maybeSingle()
    const locale = localeFromCountry(profile?.country_code)
    const total = formatMoney(Number(purchase.amount), purchase.currency, locale)
    return {
      to: purchase.email,
      name: profile?.name ?? null,
      locale,
      tags: { total, limite: String(purchase.entries_allowed) },
      summary: `Obras extra · ${total} · ${profile?.name ?? purchase.email}`,
    }
  })
}
