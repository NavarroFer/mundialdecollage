'use server'

import { redirect } from 'next/navigation'
import { Preference } from 'mercadopago'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isMercadoPagoConfigured, getMercadoPagoConfig } from '@/lib/mercadopago'
import { isWorkshopPaymentConfigured, site, getSiteUrl } from '@/lib/site'

// Only one payment per registration: whichever amount they choose here
// (seña or total) is what Mercado Pago charges. Any balance left after a
// seña is settled in person at the workshop, not through a second charge.
export async function registerForWorkshop(formData: FormData) {
  if (!isSupabaseConfigured || !isMercadoPagoConfigured || !isWorkshopPaymentConfigured()) {
    redirect('/taller/inscripcion?error=not_configured')
  }

  const { totalPrice, minDeposit } = site.workshop
  if (totalPrice === null || minDeposit === null) {
    redirect('/taller/inscripcion?error=not_configured')
  }

  const paymentType = String(formData.get('payment_type') ?? '')
  if (paymentType !== 'sena' && paymentType !== 'completo') {
    redirect('/taller/inscripcion?error=invalid_payment_type')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')
  if (!user.email) redirect('/taller/inscripcion?error=missing_email')

  const { data: existing } = await supabase
    .from('workshop_registrations')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) redirect('/taller/inscripcion')

  // Regular RLS only lets a user see their own row, so counting paid seats
  // across everyone needs the service-role client (same pattern as the
  // public unsubscribe link in lib/supabase/admin.ts).
  const admin = createAdminClient()
  const { count } = await admin
    .from('workshop_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'paid')
  if ((count ?? 0) >= site.workshop.capacity) {
    redirect('/taller/inscripcion?error=full')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()

  const amountTotal = paymentType === 'sena' ? minDeposit : totalPrice

  const { data: registration, error: insertError } = await supabase
    .from('workshop_registrations')
    .insert({
      user_id: user.id,
      email: user.email,
      name: profile?.name ?? null,
      payment_type: paymentType,
      amount_total: amountTotal,
    })
    .select('id')
    .single()

  if (insertError || !registration) {
    // Unique violation on user_id means a row appeared between our check
    // and the insert (e.g. a double submit) — treat it as already registered.
    if (insertError?.code === '23505') redirect('/taller/inscripcion')
    redirect('/taller/inscripcion?error=save_failed')
  }

  const siteUrl = getSiteUrl()
  const title =
    paymentType === 'sena' ? 'Seña — Taller de collage' : 'Taller de collage (pago completo)'

  let initPoint: string | undefined
  let preferenceId: string | undefined
  try {
    const preference = await new Preference(getMercadoPagoConfig()).create({
      body: {
        items: [
          {
            id: `taller-collage-${paymentType}`,
            title,
            quantity: 1,
            unit_price: amountTotal,
            currency_id: 'ARS',
          },
        ],
        payer: {
          email: user.email,
          name: profile?.name ?? undefined,
        },
        external_reference: registration.id,
        back_urls: {
          success: `${siteUrl}/taller/inscripcion`,
          pending: `${siteUrl}/taller/inscripcion`,
          failure: `${siteUrl}/taller/inscripcion`,
        },
        auto_return: 'approved',
        notification_url: `${siteUrl}/api/mercadopago/webhook`,
      },
    })
    initPoint = preference.init_point
    preferenceId = preference.id
  } catch {
    redirect('/taller/inscripcion?error=mp_failed')
  }

  if (!initPoint) {
    redirect('/taller/inscripcion?error=mp_failed')
  }

  // Only admins (or the service role) can update this table per RLS, so
  // saving the preference id back onto the row needs the admin client too.
  await admin
    .from('workshop_registrations')
    .update({ mp_preference_id: preferenceId })
    .eq('id', registration.id)

  redirect(initPoint)
}
