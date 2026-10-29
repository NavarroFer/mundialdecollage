import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { SubmitButton } from '@/components/admin/submit-button'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getI18n } from '@/lib/i18n/server'
import type { Messages } from '@/lib/i18n/messages/es'
import { fmt, formatMoney } from '@/lib/i18n/format'
import { clubMembershipPlanById, coinPacks } from '@/lib/store'
import { canUseOwnClubGallery } from '@/lib/club-launch'
import { mercadoPago } from '@/lib/payments/providers/mercadopago'
import { payPal } from '@/lib/payments/providers/paypal'
import { isPayPalServerConfigured } from '@/lib/payments/paypal/client'
import { paypalPlanId } from '@/lib/payments/paypal/plans'
import { buyCoinPack, joinClub, joinClubWithPayPal } from './actions'

const PACK_NAMES = { chico: 'Chico', mediano: 'Mediano', mecenas: 'Mecenas' } as const

// The artist's own place in the Club. Private (reads the session), so it is
// not one of lib/static-pages.ts. With no gallery, or after a lapse, it offers
// the membership; waiting for the first charge it says so; once the gallery
// is active it links to it.
export default async function MyGalleryPage({ searchParams }: { searchParams: Promise<{ error?: string; suscripcion?: string; monedas?: string }> }) {
  if (!isSupabaseConfigured) redirect('/')
  const { locale, m } = await getI18n()
  const t = m.club
  const user = await getCurrentUser()

  // Shown even while the Club is closed: a founder given a courtesy gallery
  // signs in here.
  if (!user) {
    return (
      <Shell>
        <h1 className="font-display text-3xl uppercase">{t.signInTitle}</h1>
        <p className="my-6 text-muted-foreground">{t.signInBody}</p>
        <GoogleSignInButton next="/mi-galeria" />
      </Shell>
    )
  }

  const { error, monedas } = await searchParams
  const supabase = await createClient()
  const [{ data: gallery }, { data: wallet }] = await Promise.all([
    supabase.from('club_galleries').select('slug, title, status').eq('user_id', user.id).maybeSingle(),
    supabase.from('club_wallets').select('balance').eq('user_id', user.id).maybeSingle(),
  ])
  // Closed (lib/club-launch.ts): the page does not exist for anyone but the
  // admins and the members whose gallery is already active.
  if (!canUseOwnClubGallery(user.email, gallery?.status)) notFound()

  if (gallery?.status === 'active') {
    return (
      <Shell>
        <h1 className="font-display text-3xl uppercase">{t.activeTitle}</h1>
        <p className="my-6 text-muted-foreground">{gallery.title} · {fmt(t.coins, { coins: (wallet?.balance ?? 0).toLocaleString(locale) })}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/club/${gallery.slug}`} className="inline-flex min-h-11 items-center rounded-full bg-ink px-6 font-bold text-white">{t.viewGallery}</Link>
          <Link href="/mi-galeria/editar" className="inline-flex min-h-11 items-center rounded-full border-2 border-ink px-6 font-bold">{t.editor.open}</Link>
        </div>
        <section className="mt-10 border-t pt-8">
          <h2 className="font-display text-2xl uppercase">{t.packsTitle}</h2>
          <p className="my-3 text-sm text-muted-foreground">{t.packsBody}</p>
          <TermsNotice t={t} />
          {monedas === 'ok' && <p role="status" className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm">{t.coinsPending}</p>}
          {error && <p role="alert" className="mb-4 rounded-lg bg-collage-red/10 px-3 py-2 text-sm font-medium text-collage-red">{t.errorUnavailable}</p>}
          <ul className="space-y-3">
            {coinPacks.map((pack) => (
              <li key={pack.id} className="rounded-xl border p-4 text-left">
                <form action={buyCoinPack} className="space-y-3">
                  <input type="hidden" name="pack" value={pack.id} />
                  <p className="font-bold">{fmt(t.pack, { name: PACK_NAMES[pack.id] })} · {fmt(t.coins, { coins: pack.coins.toLocaleString(locale) })}</p>
                  <div className="flex flex-wrap gap-2">
                    {mercadoPago.isConfigured && <SubmitButton name="currency" value="ARS" variant="outline" className="min-h-11">{fmt(t.buyArs, { price: formatMoney(locale, pack.priceArs, 'ARS') })}</SubmitButton>}
                    {payPal.isConfigured && <SubmitButton name="currency" value="USD" variant="outline" className="min-h-11">{fmt(t.buyUsd, { price: formatMoney(locale, pack.priceUsd, 'USD') })}</SubmitButton>}
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </Shell>
    )
  }

  if (gallery?.status === 'draft') {
    return (
      <Shell>
        <h1 className="font-display text-3xl uppercase">{t.pendingTitle}</h1>
        <p className="my-6 text-muted-foreground">{t.pendingBody}</p>
        {/* Whoever closed Mercado Pago before paying can start again: the same gallery is relinked. */}
        <JoinForms t={t} outline />
        <TermsNotice t={t} />
      </Shell>
    )
  }

  const plan = clubMembershipPlanById('club-monthly')
  const paypalAvailable = paypalJoinAvailable()
  return (
    <Shell>
      <h1 className="font-display text-3xl uppercase">{t.joinTitle}</h1>
      <p className="my-4 text-muted-foreground">{t.joinBody}</p>
      {plan && <p className="font-display text-2xl">{fmt(t.price, { price: formatMoney(locale, plan.priceArs, 'ARS') })}{paypalAvailable && <span className="text-muted-foreground"> · {fmt(t.price, { price: formatMoney(locale, plan.priceUsd, 'USD') })}</span>}</p>}
      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-collage-red/10 px-3 py-2 text-sm font-medium text-collage-red">
          {error === 'invalid' ? t.errorInvalid : t.errorUnavailable}
        </p>
      )}
      <JoinForms t={t} />
      <p className="mt-3 text-xs text-muted-foreground">{t.joinNote}</p>
      <TermsNotice t={t} />
    </Shell>
  )
}

function TermsNotice({ t }: { t: Messages['club'] }) {
  const [before, after] = t.termsNotice.split('{link}')
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      {before}<Link href="/terminos-y-condiciones#club" className="underline">{t.termsLink}</Link>{after}
    </p>
  )
}

function JoinForms({ t, outline }: { t: Messages['club']; outline?: boolean }) {
  return (
    <div className="mt-6 space-y-3">
      {mercadoPago.isConfigured && (
        <form action={joinClub}>
          <SubmitButton variant={outline ? 'outline' : 'default'} className="min-h-11 w-full">{t.join}</SubmitButton>
        </form>
      )}
      {paypalJoinAvailable() && (
        <form action={joinClubWithPayPal}>
          <SubmitButton variant="outline" className="min-h-11 w-full">{t.joinPaypal}</SubmitButton>
        </form>
      )}
    </div>
  )
}

/** PayPal sells the Club only once its plan has been created and its id loaded. */
function paypalJoinAvailable() {
  return isPayPalServerConfigured && Boolean(paypalPlanId('club-monthly'))
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg rounded-2xl bg-card p-8 text-center">{children}</div>
    </main>
  )
}
