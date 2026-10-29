'use server'

import { redirect } from 'next/navigation'
import { PreApproval } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { upsertCustomer } from '@/lib/payments/customers'
import { startClubMpSubscription } from '@/lib/club-subscriptions'
import { createCoinPackCheckout } from '@/lib/club-payments'
import { mercadoPago } from '@/lib/payments/providers/mercadopago'
import { payPal } from '@/lib/payments/providers/paypal'
import { coinPackById } from '@/lib/store'
import type { Checkout } from '@/lib/payments/provider'
import { getSiteUrl } from '@/lib/site'

// «Suscribirme al Club»: the artist's gallery is created here, when they
// start paying, and goes live with the first approved charge
// (lib/club-subscriptions.ts). redirect() throws, so it stays out of any try.
export async function joinClub() {
  const user = await getCurrentUser()
  if (!user) redirect('/mi-galeria')
  if (!isSupabaseConfigured || !isMercadoPagoConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) redirect('/mi-galeria?error=unavailable')

  const { data: profile } = await (await createClient()).from('profiles').select('name').eq('id', user.id).maybeSingle()
  const metadataName = (user.user_metadata as { full_name?: string } | undefined)?.full_name
  const name = profile?.name?.trim() || metadataName?.trim() || (user.email ?? '').split('@')[0]

  const result = await startClubMpSubscription(
    { userId: user.id, email: user.email ?? '', name, planId: 'club-monthly', backUrl: `${getSiteUrl()}/mi-galeria?suscripcion=ok` },
    {
      admin: createAdminClient(),
      upsertCustomer,
      async createPreapproval({ reference, reason, payerEmail, amount, backUrl }) {
        const preapproval = await new PreApproval(getMercadoPagoConfig()).create({
          body: {
            reason,
            external_reference: reference,
            payer_email: payerEmail,
            auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: amount, currency_id: 'ARS' },
            back_url: backUrl,
            status: 'pending',
          },
        })
        return { id: preapproval.id, checkoutUrl: preapproval.init_point }
      },
    },
  )
  if (!result.ok) redirect(`/mi-galeria?error=${result.error === 'already_member' ? 'already' : result.error}`)

  redirect(result.checkoutUrl)
}

// A one-time coin pack, in pesos with Mercado Pago or in dollars with PayPal.
// The coins are credited when the provider reports the payment
// (lib/coin-pack-payments.ts), not when the buyer comes back.
export async function buyCoinPack(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/mi-galeria')
  const pack = coinPackById(String(formData.get('pack') ?? ''))
  const provider = formData.get('currency') === 'USD' ? payPal : mercadoPago
  if (!pack || !user.email || !provider.isConfigured || !isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) redirect('/mi-galeria?error=unavailable')

  const back = `${getSiteUrl()}/mi-galeria`
  let checkout: Checkout
  try {
    checkout = await createCoinPackCheckout({
      userId: user.id,
      email: user.email,
      packId: pack.id,
      provider,
      returnUrls: { success: `${back}?monedas=ok`, pending: `${back}?monedas=ok`, failure: back },
    })
  } catch (err) {
    console.error('buyCoinPack: failed to create checkout', provider.id, pack.id, err)
    redirect('/mi-galeria?error=unavailable')
  }
  redirect(checkout.url)
}
