import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Coins, DoorOpen, Palette, Users } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { ScrollToTop } from '@/components/scroll-to-top'
import { fmt, formatMoney } from '@/lib/i18n/format'
import { getI18n } from '@/lib/i18n/server'
import { isClubOpen } from '@/lib/club-launch'
import { clubMembershipPlanById } from '@/lib/store'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.clubLanding.metaTitle, description: m.clubLanding.metaDescription, alternates: { canonical: '/club' } }
}

// Same order as m.clubLanding.features: room, coins, style, visitors.
const FEATURE_ICONS = [DoorOpen, Coins, Palette, Users]

// The Club's pitch. Everyone sees the same page (its anonymous copy is built
// ahead, lib/static-pages.ts), so it reads no session: the button goes to
// /mi-galeria, which does, and offers whichever payment the visitor can use.
export default async function ClubPage() {
  if (!isClubOpen()) notFound()
  const { locale, m } = await getI18n()
  const t = m.clubLanding
  const plan = clubMembershipPlanById('club-monthly')

  return (
    <>
      <ScrollToTop />
      <SiteHeader />
      <main className="bg-grain py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <span className="torn-strip inline-block -rotate-1 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
            {t.badge}
          </span>
          <h1 className="font-display mt-7 max-w-3xl text-4xl tracking-tight text-ink uppercase sm:text-6xl">{t.title}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{t.lead}</p>
          <Link href="/mi-galeria" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-ink px-8 font-bold text-white">{t.cta}</Link>

          <section className="mt-16" aria-labelledby="club-features-title">
            <h2 id="club-features-title" className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">{t.featuresTitle}</h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2">
              {t.features.map((feature, i) => {
                const Icon = FEATURE_ICONS[i] ?? DoorOpen
                return (
                  <li key={feature.title} className="rounded-3xl border-2 border-ink/10 bg-card p-6 shadow-sm">
                    <Icon className="size-8 text-collage-red" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-bold text-ink">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{fmt(feature.body, { coins: plan?.monthlyCoins ?? 0 })}</p>
                  </li>
                )
              })}
            </ul>
          </section>

          {plan && (
            <section className="mt-14 max-w-3xl -rotate-[0.4deg] rounded-3xl border-2 border-ink/10 bg-collage-blue/5 p-6 sm:p-8" aria-labelledby="club-price-title">
              <h2 id="club-price-title" className="font-display text-2xl tracking-tight text-ink uppercase">{t.priceTitle}</h2>
              <p className="mt-3 text-lg font-semibold text-foreground">
                {fmt(t.price, { ars: formatMoney(locale, plan.priceArs, 'ARS'), usd: formatMoney(locale, plan.priceUsd, 'USD') })}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{t.cancel}</p>
              <Link href="/mi-galeria" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-ink px-8 font-bold text-white">{t.cta}</Link>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
