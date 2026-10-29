import { rowPurchase } from '@/lib/payments/purchases'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Credits a paid pack through the database's idempotent ledger primitive.
 * `rowPurchase` deliberately calls this again for an already-paid row so a
 * transient RPC failure is recovered by the next webhook/reconciliation.
 */
async function creditCoinPack(purchaseId: string) {
  const admin = createAdminClient()
  const { data: purchase, error: readError } = await admin
    .from('coin_pack_purchases')
    .select('user_id, coins')
    .eq('id', purchaseId)
    .maybeSingle()
  if (readError || !purchase) throw new Error(readError?.message ?? 'Coin pack purchase not found')

  const { error } = await admin.rpc('credit_club_coins', {
    p_user_id: purchase.user_id,
    p_delta: purchase.coins,
    p_kind: 'purchase',
    p_reference_id: `coin-pack:${purchaseId}`,
  })
  if (error) throw new Error(error.message)
}

export const coinPackPurchase = rowPurchase({
  table: 'coin_pack_purchases',
  label: 'coin pack payment',
  sendReceipt: creditCoinPack,
})
