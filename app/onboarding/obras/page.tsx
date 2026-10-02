import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, Plus } from 'lucide-react'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isMercadoPagoConfigured } from '@/lib/mercadopago'
import { ADMIN_EMAILS } from '@/lib/admin'
import { site } from '@/lib/site'
import { entryLimit } from '@/lib/entries'
import { syncEntryPaymentById } from '@/lib/entry-payments'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { SubmitButton } from '@/components/admin/submit-button'
import { getI18n } from '@/lib/i18n/server'
import { fmt, formatMoney } from '@/lib/i18n/format'
import { OnboardingSteps } from '../onboarding-steps'
import { EntryPicker } from './entry-picker'
import { saveEntryChoice, startEntryCheckout } from './actions'

// "Mis obras": every obra on the artist's account, and which ones take part.
// Reached after uploading another obra, from /onboarding when an artist has
// several obras and never chose (e.g. more than one sent by mail), and back
// from Mercado Pago after paying for more entries. Not linked from the home.
export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    pago?: string
    payment_id?: string
    collection_id?: string
    nueva?: string
    guardado?: string
  }>
}) {
  if (!isSupabaseConfigured) redirect('/')

  const { locale, m } = await getI18n()
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) {
    return (
      <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg rounded-2xl bg-card p-8 text-center">
          <OnboardingSteps current="signin" m={m} />
          <h1 className="font-display text-3xl uppercase">{m.entries.signInTitle}</h1>
          <p className="my-6 text-muted-foreground">{m.entries.signInBody}</p>
          <GoogleSignInButton next="/onboarding/obras" />
        </div>
      </main>
    )
  }
  if (ADMIN_EMAILS.includes(user.email ?? '')) redirect('/admin')

  const params = await searchParams

  // Back from Mercado Pago: confirm the payment with Mercado Pago right away
  // instead of waiting for the webhook, so the new limit shows on arrival.
  const paymentId = params.payment_id ?? params.collection_id
  if (paymentId) await syncEntryPaymentById(paymentId)

  const [{ data: artworks }, { data: profile }, { data: purchases }] = await Promise.all([
    supabase
      .from('artworks')
      .select('id, title, image_url, is_selected, is_entered, created_at')
      .eq('profile_id', user.id)
      .is('archived_at', null)
      .is('duplicate_of', null)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('entries_chosen_at').eq('id', user.id).maybeSingle(),
    supabase.from('entry_purchases').select('status, mp_payment_id').eq('user_id', user.id),
  ])

  if (!artworks || artworks.length === 0) redirect('/onboarding')

  const hasPaid = (purchases ?? []).some((purchase) => purchase.status === 'paid')
  const paymentPending =
    !hasPaid &&
    (params.pago === 'pendiente' ||
      (purchases ?? []).some((purchase) => purchase.status === 'pending' && purchase.mp_payment_id))
  const limit = entryLimit(hasPaid)
  const { paidLimit, maxStored, priceArs, priceUsd } = site.entries
  const ars = formatMoney(locale, priceArs, 'ARS')
  const usd = formatMoney(locale, priceUsd, 'USD')

  // The newest obra, when the artist just uploaded it (?nueva=1).
  const justUploaded = params.nueva ? artworks[artworks.length - 1] : undefined
  const intro = justUploaded
    ? m.entries.newUploaded
    : artworks.length > 1 && !profile?.entries_chosen_at
      ? fmt(m.entries.fromMail, { count: artworks.length })
      : hasPaid
        ? fmt(m.entries.introPaid, { limit: paidLimit })
        : m.entries.intro

  const error = params.error ? m.entries.errors[params.error] : undefined
  const notice =
    params.pago === 'ok' && hasPaid
      ? fmt(m.entries.paymentThanks, { limit: paidLimit })
      : params.guardado
        ? m.entries.saved
        : undefined

  return (
    <main className="bg-grain min-h-screen px-5 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <OnboardingSteps current="details" m={m} />
        <p className="text-center text-sm font-bold tracking-[0.25em] text-collage-blue uppercase">{m.entries.eyebrow}</p>
        <h1 className="font-display mt-3 text-center text-3xl tracking-tight text-ink uppercase sm:text-4xl">
          {hasPaid ? m.entries.titlePaid : m.entries.title}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">{intro}</p>

        {error && (
          <p role="alert" className="mt-6 rounded-lg bg-collage-red/10 px-3 py-2 text-center text-sm font-medium text-collage-red">
            {fmt(error, { limit })}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-collage-blue/10 px-3 py-2 text-sm font-medium text-collage-blue">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {notice}
          </p>
        )}
        {params.pago === 'error' && !hasPaid && (
          <p role="alert" className="mt-6 rounded-lg bg-collage-red/10 px-3 py-2 text-center text-sm font-medium text-collage-red">
            {m.entries.paymentFailed}
          </p>
        )}

        <EntryPicker
          artworks={artworks.map((artwork) => ({
            id: artwork.id,
            title: artwork.title,
            imageUrl: artwork.image_url,
            isSelected: artwork.is_selected,
            isEntered: artwork.is_entered,
          }))}
          limit={limit}
          preselectId={justUploaded?.id}
          action={saveEntryChoice}
        />

        {hasPaid ? (
          <p className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-collage-blue">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {m.entries.paidBadge}
          </p>
        ) : paymentPending ? (
          <div className="mt-10 rounded-2xl border-2 border-collage-blue/20 bg-collage-blue/5 p-6">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Clock className="size-4" aria-hidden="true" />
              {m.entries.pendingTitle}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{fmt(m.entries.pendingBody, { limit: paidLimit })}</p>
          </div>
        ) : (
          <section className="mt-10 rounded-2xl border-2 border-ink/10 bg-card p-6 sm:p-8">
            <h2 className="font-display text-2xl text-ink">{m.entries.payTitle}</h2>
            <p className="mt-2 text-muted-foreground">{fmt(m.entries.payBody, { ars, usd, limit: paidLimit })}</p>
            {isMercadoPagoConfigured ? (
              <form action={startEntryCheckout} className="mt-5">
                <SubmitButton size="lg" pendingLabel={m.common.confirming} className="w-full">
                  {fmt(m.entries.payMercadoPago, { ars })}
                </SubmitButton>
              </form>
            ) : (
              <p className="mt-5 rounded-lg bg-paper p-3 text-sm text-muted-foreground">
                {fmt(m.entries.payUnavailable, { email: site.email })}
              </p>
            )}
            {/* PayPal (USD) is hidden for now; m.entries.payPaypal is kept for when it returns. */}
          </section>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 text-sm">
          {artworks.length < maxStored ? (
            <Link href="/onboarding?another=1" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-collage-blue underline underline-offset-4">
              <Plus className="size-4" aria-hidden="true" />
              {m.entries.uploadAnother}
            </Link>
          ) : (
            <p className="text-muted-foreground">{fmt(m.entries.maxStored, { max: maxStored })}</p>
          )}
          <Link href="/" className="inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4">
            {m.common.backHome}
          </Link>
        </div>
      </div>
    </main>
  )
}
