import Link from 'next/link'
import { Check, PackageOpen, Scissors } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { ScrollToTop } from '@/components/scroll-to-top'
import { Button } from '@/components/ui/button'
import { PaypalSubscriptionCheckout } from '@/components/paypal-subscription-checkout'
import { formatUsd, subscriptionPlans } from '@/lib/store'
import { isPayPalCheckoutConfigured } from '@/lib/payments/paypal/client'
import { getI18n } from '@/lib/i18n/server'
import { TrackView } from '@/components/track'
import { WaitlistSignup } from '@/components/waitlist-signup'
import { MagazinePromo } from '@/components/store-promo'

export default async function StorePage({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const [{ locale, m }, { desde }] = await Promise.all([getI18n(), searchParams])
  const t = m.store
  return (
    <>
      <ScrollToTop />
      <TrackView event="store_view" />
      {/* The daily «Así le fue a tu obra» mail links here with ?desde=mail. */}
      {desde === 'mail' && <TrackView event="store_from_email" />}
      <SiteHeader />
      <main>
        <section className="bg-grain relative overflow-hidden border-b-2 border-ink/10 py-18 sm:py-24">
          <Scissors className="absolute -left-7 top-8 h-36 w-36 -rotate-24 text-collage-red/15" strokeWidth={1} />
          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
            <span className="torn-strip inline-block -rotate-1 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
              {t.badge}
            </span>
            <h1 className="font-display mt-7 text-4xl tracking-tight text-ink uppercase sm:text-6xl">{t.title}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              {t.intro}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20" aria-labelledby="plans-title">
          <MagazinePromo m={m} event="magazine_click_store" forArtist={false} className="mb-10" />
          <h2 id="plans-title" className="sr-only">{t.plansLabel}</h2>
          <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {subscriptionPlans.map((plan) => {
              const localizedPlan = t.plans[plan.id]
              return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border-2 p-6 shadow-sm ${plan.featured ? 'border-collage-blue bg-collage-blue text-primary-foreground lg:-translate-y-3' : 'border-ink/15 bg-card'}`}
              >
                {plan.featured && (
                  <span className="torn-strip absolute -top-4 left-1/2 -translate-x-1/2 bg-collage-yellow px-4 py-1.5 text-xs font-bold tracking-[0.16em] text-ink uppercase">
                    {t.popular}
                  </span>
                )}
                <PackageOpen className={`h-8 w-8 ${plan.featured ? 'text-collage-yellow' : 'text-collage-red'}`} aria-hidden="true" />
                <h2 className="font-display mt-5 text-3xl tracking-tight uppercase">{localizedPlan.name}</h2>
                <p className={`mt-3 min-h-12 text-sm ${plan.featured ? 'text-paper/80' : 'text-muted-foreground'}`}>{localizedPlan.description}</p>
                <p className="mt-6 text-3xl font-bold tracking-tight">
                  {formatUsd(plan.priceUsd, locale)} <span className="text-base font-medium">{t.perMonth}</span>
                </p>
                <ul className={`mt-7 space-y-3 border-t-2 pt-6 text-sm ${plan.featured ? 'border-paper/25' : 'border-ink/10'}`}>
                  {localizedPlan.contents.map((content) => (
                    <li key={content} className="flex gap-2.5">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? 'text-collage-yellow' : 'text-collage-blue'}`} aria-hidden="true" />
                      <span>{content}</span>
                    </li>
                  ))}
                </ul>
                {isPayPalCheckoutConfigured ? (
                  <PaypalSubscriptionCheckout plan={plan.id} clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!} />
                ) : (
                  <Button size="lg" variant={plan.featured ? 'default' : 'primary'} className="mt-8 w-full" disabled>{t.comingSoon}</Button>
                )}
                <p className={`mt-4 text-center text-xs ${plan.featured ? 'text-paper/70' : 'text-muted-foreground'}`}>{t.cancelAnytime}</p>
              </article>
              )
            })}
          </div>
        </section>

        <section className="border-t-2 border-ink/10 bg-muted py-14">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <h2 className="font-display text-3xl tracking-tight uppercase">{t.moreTitle}</h2>
            <p className="mt-4 text-muted-foreground">{t.moreBody}</p>
            <WaitlistSignup source="tienda" className="mx-auto mt-8 text-left" />
            <Link href="/" className="mt-7 inline-block text-sm font-semibold text-collage-blue underline underline-offset-4">{t.back}</Link>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="faq-title">
          <span className="text-xs font-bold tracking-[0.2em] text-collage-red uppercase">{t.faqEyebrow}</span>
          <h2 id="faq-title" className="font-display mt-3 text-3xl tracking-tight uppercase sm:text-4xl">{t.faqTitle}</h2>
          <div className="mt-8 divide-y-2 divide-ink/10 border-y-2 border-ink/10">
            {t.faq.map(({ q, a }) => <details key={q} className="group py-5"><summary className="cursor-pointer list-none pr-8 text-base font-bold marker:hidden">{q}</summary><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{a}</p></details>)}
          </div>
        </section>
      </main>
      <Footer showWaitlist={false} />
    </>
  )
}
