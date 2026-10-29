'use server'

import { redirect } from 'next/navigation'
import { PreApproval } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getMercadoPagoConfig, isMercadoPagoConfigured } from '@/lib/mercadopago'
import { upsertCustomer } from '@/lib/payments/customers'
import { startClubSubscription, type ClubProvider } from '@/lib/club-subscriptions'
import { isPayPalServerConfigured, paypal } from '@/lib/payments/paypal/client'
import { paypalPlanId } from '@/lib/payments/paypal/plans'
import { createCoinPackCheckout } from '@/lib/club-payments'
import { mercadoPago } from '@/lib/payments/providers/mercadopago'
import { payPal } from '@/lib/payments/providers/paypal'
import { coinPackById } from '@/lib/store'
import type { Checkout } from '@/lib/payments/provider'
import { getSiteUrl } from '@/lib/site'
import { canUseClub, canUseOwnClubGallery } from '@/lib/club-launch'

// «Suscribirme al Club»: the artist's gallery is created here, when they
// start paying, and goes live with the first approved charge
// (lib/club-subscriptions.ts). Mercado Pago charges pesos from a preapproval
// made on the spot; PayPal subscribes to the plan made in its dashboard
// (scripts/paypal-setup.mjs club). redirect() throws, so it stays out of any try.
async function startMembership(provider: ClubProvider) {
  const user = await getCurrentUser()
  if (!user) redirect('/mi-galeria')
  if (!canUseClub(user.email)) redirect('/')
  const configured = provider === 'paypal' ? isPayPalServerConfigured : isMercadoPagoConfigured
  if (!isSupabaseConfigured || !configured || !process.env.SUPABASE_SERVICE_ROLE_KEY) redirect('/mi-galeria?error=unavailable')

  const { data: profile } = await (await createClient()).from('profiles').select('name').eq('id', user.id).maybeSingle()
  const metadataName = (user.user_metadata as { full_name?: string } | undefined)?.full_name
  const name = profile?.name?.trim() || metadataName?.trim() || (user.email ?? '').split('@')[0]
  const site = getSiteUrl()

  const result = await startClubSubscription(
    { provider, userId: user.id, email: user.email ?? '', name, planId: 'club-monthly', backUrl: `${site}/mi-galeria?suscripcion=ok` },
    {
      admin: createAdminClient(),
      upsertCustomer,
      paypalPlanId: paypalPlanId('club-monthly'),
      async createSubscription({ localId, reference, reason, payerEmail, amount, backUrl }) {
        if (provider === 'paypal') {
          const subscription = await paypal<{ id: string; links?: { rel: string; href: string }[] }>('/v1/billing/subscriptions', {
            method: 'POST',
            requestId: `club-subscription-${localId}`,
            body: {
              plan_id: paypalPlanId('club-monthly'),
              custom_id: localId,
              subscriber: { email_address: payerEmail },
              application_context: {
                brand_name: process.env.BRAND_NAME ?? 'Mundial de Collage',
                shipping_preference: 'NO_SHIPPING',
                user_action: 'SUBSCRIBE_NOW',
                return_url: backUrl,
                cancel_url: `${site}/mi-galeria`,
              },
            },
          })
          return { id: subscription.id, checkoutUrl: subscription.links?.find((link) => link.rel === 'approve')?.href }
        }
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

export async function joinClub() {
  return startMembership('mercadopago')
}

export async function joinClubWithPayPal() {
  return startMembership('paypal')
}

// A one-time coin pack, in pesos with Mercado Pago or in dollars with PayPal.
// The coins are credited when the provider reports the payment
// (lib/coin-pack-payments.ts), not when the buyer comes back.
export async function buyCoinPack(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/mi-galeria')
  // Closed, only a founder whose gallery is already active gets past the admins' gate.
  if (!canUseClub(user.email)) {
    const { data: gallery } = await (await createClient()).from('club_galleries').select('status').eq('user_id', user.id).maybeSingle()
    if (!canUseOwnClubGallery(user.email, gallery?.status)) redirect('/')
  }
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
