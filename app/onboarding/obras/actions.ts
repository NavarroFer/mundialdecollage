'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Preference } from 'mercadopago'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isMercadoPagoConfigured, getMercadoPagoConfig } from '@/lib/mercadopago'
import { ADMIN_EMAILS } from '@/lib/admin'
import { site, getSiteUrl } from '@/lib/site'
import { entryExternalReference, entryLimit, resolveEntryChoice } from '@/lib/entries'
import { hasPaidEntries } from '@/lib/entry-payments'

// The artist picks which of their obras are postulated (one for free, more
// after paying) and which one represents them on the site. artworks has no
// UPDATE grant for artists (only admins curate it), so the writes go through
// the service-role client once every id is proven to be theirs.
export async function saveEntryChoice(formData: FormData) {
  if (!isSupabaseConfigured) redirect('/')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/onboarding/obras')

  const { data: owned, error: ownedError } = await supabase
    .from('artworks')
    .select('id, title, is_selected, legacy_submission_id')
    .eq('profile_id', user.id)
    .is('archived_at', null)
    .is('duplicate_of', null)
  if (ownedError || !owned || owned.length === 0) redirect('/onboarding/obras?error=save_failed')

  const hasPaid = await hasPaidEntries(supabase, user.id)
  const choice = resolveEntryChoice({
    ownedIds: owned.map((artwork) => artwork.id),
    requestedIds: formData.getAll('entered').map(String),
    mainId: String(formData.get('main') ?? ''),
    currentMainId: owned.find((artwork) => artwork.is_selected)?.id,
    limit: entryLimit(hasPaid),
  })
  if (!choice.ok) redirect(`/onboarding/obras?error=${choice.error}`)

  // Unselect the others before selecting the main one, so a reader never
  // finds two selected obras for the same artist.
  const admin = createAdminClient()
  const steps = [
    () => admin.from('artworks').update({ is_selected: false }).eq('profile_id', user.id).neq('id', choice.main),
    () =>
      admin
        .from('artworks')
        .update({ is_entered: false })
        .eq('profile_id', user.id)
        .not('id', 'in', `(${choice.entered.join(',')})`),
    () => admin.from('artworks').update({ is_entered: true }).eq('profile_id', user.id).in('id', choice.entered),
    () => admin.from('artworks').update({ is_selected: true }).eq('profile_id', user.id).eq('id', choice.main),
  ]
  for (const step of steps) {
    const { error } = await step()
    if (error) {
      console.error('saveEntryChoice: failed to update artworks', user.id, error)
      redirect('/onboarding/obras?error=save_failed')
    }
  }

  const { data: before } = await supabase.from('profiles').select('entries_chosen_at').eq('id', user.id).maybeSingle()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({ entries_chosen_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('details_confirmed_at')
    .maybeSingle()
  if (profileError) {
    console.error('saveEntryChoice: failed to update profile', user.id, profileError)
    redirect('/onboarding/obras?error=save_failed')
  }

  revalidatePath('/')
  revalidatePath('/participantes')
  revalidatePath('/edicion-2026')
  revalidatePath('/obras/[slug]', 'page')

  // Same rule as ParticipationStatus: an obra that Registro loaded, or one
  // without a title, still needs the artist's review — /onboarding shows it
  // for the main obra they just chose.
  const main = owned.find((artwork) => artwork.id === choice.main)
  const needsConfirmation =
    !main?.title?.trim() || (Boolean(main?.legacy_submission_id) && !profile?.details_confirmed_at)
  if (needsConfirmation) redirect('/onboarding')
  // Choosing for the first time finishes the sign-up; later changes stay here.
  redirect(before?.entries_chosen_at ? '/onboarding/obras?guardado=1' : '/onboarding/confirmado')
}

// One-time Mercado Pago payment that raises the artist's limit to
// site.entries.paidLimit. Same Checkout Pro flow as the taller
// (app/taller/actions.ts); the purchase row is written with the service-role
// client so an artist can never create one that already says "paid".
export async function startEntryCheckout() {
  if (!isSupabaseConfigured || !isMercadoPagoConfigured) {
    redirect('/onboarding/obras?error=not_configured')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/onboarding/obras')
  if (ADMIN_EMAILS.includes(user.email ?? '')) redirect('/admin')
  if (!user.email) redirect('/onboarding/obras?error=mp_failed')

  if (await hasPaidEntries(supabase, user.id)) redirect('/onboarding/obras')

  const { priceArs, paidLimit } = site.entries
  const admin = createAdminClient()
  const { data: purchase, error: insertError } = await admin
    .from('entry_purchases')
    .insert({
      user_id: user.id,
      email: user.email,
      provider: 'mercadopago',
      amount: priceArs,
      currency: 'ARS',
      entries_allowed: paidLimit,
    })
    .select('id')
    .single()
  if (insertError || !purchase) {
    console.error('startEntryCheckout: failed to create purchase', user.id, insertError)
    redirect('/onboarding/obras?error=mp_failed')
  }

  const siteUrl = getSiteUrl()
  let initPoint: string | undefined
  let preferenceId: string | undefined
  try {
    const preference = await new Preference(getMercadoPagoConfig()).create({
      body: {
        items: [
          {
            id: 'mundial-obras-extra',
            title: `Mundial de Collage — postulación de hasta ${paidLimit} obras`,
            quantity: 1,
            unit_price: priceArs,
            currency_id: 'ARS',
          },
        ],
        payer: { email: user.email },
        external_reference: entryExternalReference(purchase.id),
        back_urls: {
          success: `${siteUrl}/onboarding/obras?pago=ok`,
          pending: `${siteUrl}/onboarding/obras?pago=pendiente`,
          failure: `${siteUrl}/onboarding/obras?pago=error`,
        },
        auto_return: 'approved',
        notification_url: `${siteUrl}/api/mercadopago/webhook`,
      },
    })
    initPoint = preference.init_point
    preferenceId = preference.id
  } catch (err) {
    console.error('startEntryCheckout: failed to create preference', user.id, err)
    redirect('/onboarding/obras?error=mp_failed')
  }

  if (!initPoint) redirect('/onboarding/obras?error=mp_failed')

  await admin.from('entry_purchases').update({ mp_preference_id: preferenceId }).eq('id', purchase.id)

  redirect(initPoint)
}
