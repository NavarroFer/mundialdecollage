import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MpSubscriptionCheckout } from '@/components/mp-subscription-checkout'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { TrackView } from '@/components/track'
import { planById, formatArs } from '@/lib/store'
import { LOCALE_INFO } from '@/lib/i18n/locales'
import { getI18n } from '@/lib/i18n/server'

export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planId } = await searchParams
  const plan = planById(planId ?? '')
  if (!plan) notFound()
  const { m, locale } = await getI18n()
  return <>
    <TrackView event="store_checkout_open" />
    <SiteHeader />
    <main className="mx-auto max-w-2xl space-y-6 px-5 py-12 sm:px-8">
      <Link href="/tienda?envio=ar" className="inline-flex min-h-11 items-center text-sm underline">{m.store.thanks.back}</Link>
      <h1 className="font-display text-3xl">{m.store.plans[plan.id].name} · {formatArs(plan.priceArs, LOCALE_INFO[locale].intl)}{m.store.perMonth} {m.store.subscriptions.shipping}</h1>
      <p className="text-sm font-semibold">{m.store.pickup.mode}</p>
      <MpSubscriptionCheckout plan={plan.id} />
    </main>
    <Footer />
  </>
}
