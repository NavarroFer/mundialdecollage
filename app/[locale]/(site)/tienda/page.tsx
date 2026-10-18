import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import { BadgeCheck, Check, PackageOpen, Scissors } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { ScrollToTop } from '@/components/scroll-to-top'
import { Button } from '@/components/ui/button'
import { cutoutPlans, subscriptionPlans, type SubscriptionPlan } from '@/lib/store'
import { planWaitlistSource } from '@/lib/waitlist'
import { cn } from '@/lib/utils'
import { getI18n } from '@/lib/i18n/server'
import { TrackView } from '@/components/track'
import { WaitlistSignup } from '@/components/waitlist-signup'
import { MagazinePromo } from '@/components/store-promo'
import { site } from '@/lib/site'
import { PaypalSubscriptionCheckout } from '@/components/paypal-subscription-checkout'
import { isMercadoPagoConfigured } from '@/lib/mercadopago'
import { correoConfigured, priceWithShippingArs } from '@/lib/correo'
import { FreeShippingBadge } from '@/components/free-shipping-badge'
import { isPayPalCheckoutConfigured } from '@/lib/payments/paypal/client'

// Argentina pays in pesos with Mercado Pago, everywhere else in dollars with
// PayPal. ?envio=ar|exterior picks one; without it, the visitor's country
// (Vercel's geolocation header) decides, and Argentina when it's unknown.
export default async function StorePage({ searchParams }: { searchParams: Promise<{ desde?: string; envio?: string }> }) {
  const [{ locale, m }, { desde, envio }, requestHeaders] = await Promise.all([getI18n(), searchParams, headers()])
  const t = m.store
  const copy = t.subscriptions
  const visitorCountry = requestHeaders.get('x-vercel-ip-country')
  const argentina = envio === 'ar' || (envio !== 'exterior' && (!visitorCountry || visitorCountry === 'AR'))
  // Until Correo Argentino's credentials are set, buyers give an address and
  // we choose the branch, at a flat fee (lib/correo.ts).
  const byAddress = !correoConfigured()
  // In pesos the shipping is in the price and the card says «Envío gratis»;
  // abroad it's still arranged and charged apart.
  const priceLabel = (priceArs: number, priceUsd: number) => argentina
    ? `ARS $${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(priceWithShippingArs(priceArs))}`
    : `USD ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(priceUsd)}`
  return (
    <>
      <ScrollToTop />
      <TrackView event="store_view" />
      {/* The daily «Así le fue a tu obra» mail links here with ?desde=mail. */}
      {desde === 'mail' && <TrackView event="store_from_email" />}
      <SiteHeader />
      <main>
        {/* Short, so the plans are on the first screen: what each one costs
            and what arrives is what visitors came for. */}
        <section className="bg-grain relative overflow-hidden border-b-2 border-ink/10 py-10 sm:py-14">
          <Scissors className="absolute -left-7 top-8 h-36 w-36 -rotate-24 text-collage-red/15" strokeWidth={1} />
          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
            <span className="torn-strip inline-block -rotate-1 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
              {t.badge}
            </span>
            <h1 className="font-display mt-5 text-4xl tracking-tight text-ink uppercase sm:text-6xl">{t.title}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {t.intro}
            </p>
            {/* On a phone the plans come right after, without the jump links. */}
            <div className="mt-6 hidden flex-wrap justify-center gap-3 sm:flex">
              <Button asChild variant="primary" size="lg"><a href="#recortes">{copy.cutoutsNav}</a></Button>
              <Button asChild variant="outline" size="lg"><a href="#membresia">{copy.membershipNav}</a></Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pt-10 pb-14 sm:px-8 sm:pt-14 sm:pb-20" aria-labelledby="plans-title">
          <div className="mb-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-bold tracking-[0.16em] text-ink uppercase">{t.regionLabel}</p>
            <nav aria-label={t.regionLabel} className="flex rounded-full border-2 border-ink/15 bg-card p-1">
              {([['ar', t.regionAr, argentina], ['exterior', t.regionAbroad, !argentina]] as const).map(([value, label, active]) => (
                <Link
                  key={value}
                  href={`/tienda?envio=${value}`}
                  scroll={false}
                  aria-current={active ? 'true' : undefined}
                  className={cn('rounded-full px-4 py-2 text-sm font-semibold transition-colors', active ? 'bg-ink text-paper' : 'text-muted-foreground hover:text-ink')}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <p className="max-w-md text-sm text-muted-foreground">{argentina ? `${byAddress ? t.pickup.addressMode : t.pickup.mode}. ${t.regionArNote}` : t.regionAbroadNote}</p>
          </div>
          <h2 id="plans-title" className="sr-only">{t.plansLabel}</h2>
          <div id="recortes" className="mb-8 scroll-mt-24">
            <p className="text-xs font-bold tracking-[0.16em] text-collage-red uppercase">{copy.cutoutsEyebrow}</p>
            <h2 className="font-display mt-3 text-3xl tracking-tight uppercase sm:text-5xl">{copy.cutoutsTitle}</h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">{copy.cutoutsBody}</p>
            {/* What sets the packs apart: who picks every scrap. */}
            <p className="torn-strip mt-6 flex w-full -rotate-1 items-start gap-2.5 bg-collage-yellow px-4 py-3 font-semibold text-ink sm:px-5 sm:text-lg lg:-rotate-[0.5deg]">
              <BadgeCheck className="mt-0.5 size-5 shrink-0 sm:mt-1" aria-hidden="true" />
              <span>
                {copy.curated.split('{curators}').flatMap((part, index) => index === 0 ? [part] : [
                  ...site.organizers.flatMap(({ name, instagram }, i) => [
                    i > 0 ? ' y ' : '',
                    <a key={name} href={instagram} target="_blank" rel="noopener noreferrer" className="font-bold whitespace-nowrap underline decoration-2 underline-offset-2">{name}</a>,
                  ]),
                  part,
                ])}
              </span>
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {cutoutPlans.map((plan) => {
              return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border-2 p-6 shadow-sm ${plan.featured ? 'border-collage-blue bg-collage-blue text-primary-foreground lg:-translate-y-3' : 'border-ink/15 bg-card'}`}
              >
                {plan.featured && (
                  <span className="torn-strip absolute -top-4 left-1/2 -translate-x-1/2 bg-collage-yellow px-4 py-1.5 text-xs font-bold tracking-[0.16em] text-ink uppercase">
                    {copy.midpoint}
                  </span>
                )}
                <Scissors className={`h-8 w-8 ${plan.featured ? 'text-collage-yellow' : 'text-collage-red'}`} aria-hidden="true" />
                <h3 className="font-display mt-5 text-3xl tracking-tight uppercase">{copy.pack} {plan.count}</h3>
                <p className={`mt-3 min-h-12 text-sm ${plan.featured ? 'text-paper/80' : 'text-muted-foreground'}`}>{copy.cutouts}</p>
                <p className="font-display mt-4 text-7xl">{plan.count}</p>
                <p className="mt-6 text-3xl font-bold tracking-tight">
                  {priceLabel(plan.priceArs, plan.priceUsd)} <span className="text-base font-medium">{t.perMonth}</span>
                </p>
                {argentina
                  ? <FreeShippingBadge label={t.freeShipping} className="mt-3 px-3.5 py-1.5 text-sm" />
                  : <p className={`mt-2 text-sm font-semibold ${plan.featured ? 'text-paper/80' : 'text-muted-foreground'}`}>{copy.shipping}</p>}
                <ul className={`mt-7 space-y-3 border-t-2 pt-6 text-sm ${plan.featured ? 'border-paper/25' : 'border-ink/10'}`}>
                  {[`${plan.count} ${copy.cutouts}`, copy.stickers].map((content) => (
                    <li key={content} className="flex gap-2.5">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? 'text-collage-yellow' : 'text-collage-blue'}`} aria-hidden="true" />
                      <span>{content}</span>
                    </li>
                  ))}
                </ul>
                {/* Abroad there's no PayPal plan for the packs yet: they're
                    arranged by mail. */}
                {argentina && isMercadoPagoConfigured ? (
                  <>
                    <Button asChild size="lg" variant={plan.featured ? 'default' : 'primary'} className="mt-8 w-full"><Link href={`/tienda/suscribirme?plan=${plan.id}`}>{t.mp.subscribe}</Link></Button>
                    <p className={`mt-4 text-center text-xs ${plan.featured ? 'text-paper/70' : 'text-muted-foreground'}`}>{t.cancelAnytime}</p>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg" variant={plan.featured ? 'default' : 'primary'} className="mt-8 w-full">
                      <a href={`mailto:${site.email}?subject=${encodeURIComponent(copy.inquirySubject.replace('{count}', String(plan.count)))}`}>{copy.inquire}</a>
                    </Button>
                    <p className={`mt-4 text-center text-xs ${plan.featured ? 'text-paper/80' : 'text-muted-foreground'}`}>{copy.setupNote}</p>
                  </>
                )}
              </article>
              )
            })}
          </div>
          <Image
            src="/tienda-productos.webp"
            alt={t.productsAlt}
            width={2000}
            height={728}
            sizes="(min-width: 1152px) 1088px, calc(100vw - 40px)"
            className="my-14 h-auto w-full rounded-2xl border-2 border-ink/10 shadow-sm"
          />
          <section id="membresia" aria-labelledby="membership-title" className="scroll-mt-24">
            <p className="text-xs font-bold tracking-[0.16em] text-collage-red uppercase">{copy.membershipEyebrow}</p>
            <h2 id="membership-title" className="font-display mt-3 text-3xl tracking-tight uppercase sm:text-5xl">{copy.membershipTitle}</h2>
            <p className="mt-4 mb-8 max-w-2xl text-muted-foreground">{copy.membershipBody}</p>
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
                <h3 className="font-display mt-5 text-3xl tracking-tight uppercase">{localizedPlan.name}</h3>
                <p className={`mt-3 min-h-12 text-sm ${plan.featured ? 'text-paper/80' : 'text-muted-foreground'}`}>{localizedPlan.description}</p>
                <p className="mt-6 text-3xl font-bold tracking-tight">
                  {priceLabel(plan.priceArs, plan.priceUsd)} <span className="text-base font-medium">{t.perMonth}</span>
                </p>
                {argentina
                  ? <FreeShippingBadge label={t.freeShipping} className="mt-3 px-3.5 py-1.5 text-sm" />
                  : <p className={`mt-2 text-sm font-semibold ${plan.featured ? 'text-paper/80' : 'text-muted-foreground'}`}>{copy.shipping}</p>}
                <ul className={`mt-7 space-y-3 border-t-2 pt-6 text-sm ${plan.featured ? 'border-paper/25' : 'border-ink/10'}`}>
                  {localizedPlan.contents.map((content) => (
                    <li key={content} className="flex gap-2.5">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? 'text-collage-yellow' : 'text-collage-blue'}`} aria-hidden="true" />
                      <span>{content}</span>
                    </li>
                  ))}
                </ul>
                {argentina ? (
                  isMercadoPagoConfigured
                    ? <Button asChild size="lg" variant={plan.featured ? 'default' : 'primary'} className="mt-8 w-full"><Link href={`/tienda/suscribirme?plan=${plan.id}`}>{t.mp.subscribe}</Link></Button>
                    : <PlanComingSoon plan={plan} label={t.comingSoon} title={t.notifyPlan} body={t.notifyPlanBody} />
                ) : isPayPalCheckoutConfigured ? (
                  <PaypalSubscriptionCheckout plan={plan.id} clientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!} />
                ) : (
                  <PlanComingSoon plan={plan} label={t.comingSoon} title={t.notifyPlan} body={t.notifyPlanBody} />
                )}
                <p className={`mt-4 text-center text-xs ${plan.featured ? 'text-paper/70' : 'text-muted-foreground'}`}>{t.cancelAnytime}</p>
              </article>
              )
            })}
          </div>
          </section>
          <p className="mt-8 text-sm text-muted-foreground">{copy.shippingNote}</p>
          <MagazinePromo m={m} event="magazine_click_store" forArtist={false} className="mt-12" />
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

// A plan that can't be bought here yet: the disabled button, and an
// «Avisame cuando abra» that lands in contacts as aviso_plan_<plan>.
function PlanComingSoon({ plan, label, title, body }: { plan: SubscriptionPlan; label: string; title: string; body: string }) {
  return (
    <>
      <Button size="lg" variant={plan.featured ? 'default' : 'primary'} className="mt-8 w-full" disabled>{label}</Button>
      <div className="mt-4 rounded-xl bg-card p-3 text-left text-ink">
        <WaitlistSignup compact source={planWaitlistSource(plan.id)} title={title} body={body} />
      </div>
    </>
  )
}
