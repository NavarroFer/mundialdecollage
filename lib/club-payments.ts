import { coinPackExternalReference } from '@/lib/payments/references'
import type { Checkout, PaymentProvider } from '@/lib/payments/provider'
import { createAdminClient } from '@/lib/supabase/admin'
import { coinPackById, type CoinPackId } from '@/lib/store'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CoinPackCheckout = {
  userId: string
  email: string
  packId: CoinPackId
  provider: PaymentProvider
  returnUrls: {
    success: string
    pending: string
    failure: string
  }
}

/** Creates the local purchase before opening the hosted provider checkout. */
export async function createCoinPackCheckout(input: CoinPackCheckout): Promise<Checkout & { purchaseId: string }> {
  const pack = coinPackById(input.packId)
  if (!pack || !UUID.test(input.userId) || !input.provider.isConfigured) throw new Error('Invalid coin pack checkout')
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid coin pack checkout')

  const currency = input.provider.id === 'mercadopago' ? 'ARS' : 'USD'
  const amount = currency === 'ARS' ? pack.priceArs : pack.priceUsd
  const admin = createAdminClient()
  const { data: purchase, error } = await admin
    .from('coin_pack_purchases')
    .insert({
      user_id: input.userId,
      pack_id: pack.id,
      coins: pack.coins,
      provider: input.provider.id,
      amount,
      currency,
    })
    .select('id')
    .single()
  if (error || !purchase) throw new Error(error?.message ?? 'Could not create coin pack purchase')

  const checkout = await input.provider.createCheckout({
    reference: coinPackExternalReference(purchase.id),
    items: [{ id: `monedas-${pack.id}`, title: `Club del Mundial · ${pack.coins} monedas`, quantity: 1, unitPrice: amount, currency }],
    payer: { email },
    returnUrls: input.returnUrls,
  })
  if (checkout.id) {
    const { error: updateError } = await admin.from('coin_pack_purchases').update({ checkout_id: checkout.id }).eq('id', purchase.id)
    if (updateError) throw new Error(updateError.message)
  }
  return { ...checkout, purchaseId: purchase.id }
}
