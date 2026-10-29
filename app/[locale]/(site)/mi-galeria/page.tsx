import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { SubmitButton } from '@/components/admin/submit-button'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getI18n } from '@/lib/i18n/server'
import { fmt, formatMoney } from '@/lib/i18n/format'
import { clubMembershipPlanById, coinPacks } from '@/lib/store'
import { mercadoPago } from '@/lib/payments/providers/mercadopago'
import { payPal } from '@/lib/payments/providers/paypal'
import { buyCoinPack, joinClub } from './actions'

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

  if (gallery?.status === 'active') {
    return (
      <Shell>
        <h1 className="font-display text-3xl uppercase">{t.activeTitle}</h1>
        <p className="my-6 text-muted-foreground">{gallery.title} · {fmt(t.coins, { coins: (wallet?.balance ?? 0).toLocaleString(locale) })}</p>
        <Link href={`/club/${gallery.slug}`} className="inline-flex min-h-11 items-center rounded-full bg-ink px-6 font-bold text-white">{t.viewGallery}</Link>
        <section className="mt-10 border-t pt-8">
          <h2 className="font-display text-2xl uppercase">{t.packsTitle}</h2>
          <p className="my-3 text-sm text-muted-foreground">{t.packsBody}</p>
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
        <form action={joinClub}>
          <SubmitButton variant="outline" className="min-h-11">{t.join}</SubmitButton>
        </form>
      </Shell>
    )
  }

  const plan = clubMembershipPlanById('club-monthly')
  return (
    <Shell>
      <h1 className="font-display text-3xl uppercase">{t.joinTitle}</h1>
      <p className="my-4 text-muted-foreground">{t.joinBody}</p>
      {plan && <p className="font-display text-2xl">{fmt(t.price, { price: formatMoney(locale, plan.priceArs, 'ARS') })}</p>}
      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-collage-red/10 px-3 py-2 text-sm font-medium text-collage-red">
          {error === 'invalid' ? t.errorInvalid : t.errorUnavailable}
        </p>
      )}
      <form action={joinClub} className="mt-6">
        <SubmitButton className="min-h-11 w-full">{t.join}</SubmitButton>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">{t.joinNote}</p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-grain flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg rounded-2xl bg-card p-8 text-center">{children}</div>
    </main>
  )
}
