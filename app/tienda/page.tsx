import Link from 'next/link'
import { Check, PackageOpen, Scissors } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { ScrollToTop } from '@/components/scroll-to-top'
import { Button } from '@/components/ui/button'
import { formatArs, subscriptionPlans } from '@/lib/store'

export default function StorePage() {
  return (
    <>
      <ScrollToTop />
      <SiteHeader />
      <main>
        <section className="bg-grain relative overflow-hidden border-b-2 border-ink/10 py-18 sm:py-24">
          <Scissors className="absolute -left-7 top-8 h-36 w-36 -rotate-24 text-collage-red/15" strokeWidth={1} />
          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
            <span className="torn-strip inline-block -rotate-1 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
              Monthly collage club
            </span>
            <h1 className="font-display mt-7 text-4xl tracking-tight text-ink uppercase sm:text-6xl">Paper in the mail</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Monthly collage supplies and printed matter, assembled in Mar del Plata and sent across Argentina.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20" aria-labelledby="plans-title">
          <h2 id="plans-title" className="sr-only">Subscription plans</h2>
          <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {subscriptionPlans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border-2 p-6 shadow-sm ${plan.featured ? 'border-collage-blue bg-collage-blue text-primary-foreground lg:-translate-y-3' : 'border-ink/15 bg-card'}`}
              >
                {plan.featured && (
                  <span className="torn-strip absolute -top-4 left-1/2 -translate-x-1/2 bg-collage-yellow px-4 py-1.5 text-xs font-bold tracking-[0.16em] text-ink uppercase">
                    Most popular
                  </span>
                )}
                <PackageOpen className={`h-8 w-8 ${plan.featured ? 'text-collage-yellow' : 'text-collage-red'}`} aria-hidden="true" />
                <h2 className="font-display mt-5 text-3xl tracking-tight uppercase">{plan.name}</h2>
                <p className={`mt-3 min-h-12 text-sm ${plan.featured ? 'text-paper/80' : 'text-muted-foreground'}`}>{plan.description}</p>
                <p className="mt-6 text-3xl font-bold tracking-tight">
                  {formatArs(plan.priceArs)} <span className="text-base font-medium">/ month</span>
                </p>
                <ul className={`mt-7 space-y-3 border-t-2 pt-6 text-sm ${plan.featured ? 'border-paper/25' : 'border-ink/10'}`}>
                  {plan.contents.map((content) => (
                    <li key={content} className="flex gap-2.5">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? 'text-collage-yellow' : 'text-collage-blue'}`} aria-hidden="true" />
                      <span>{content}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" variant={plan.featured ? 'default' : 'primary'} className="mt-8 w-full">
                  <a href={plan.checkoutUrl}>Subscribe with Mercado Pago</a>
                </Button>
                <p className={`mt-4 text-center text-xs ${plan.featured ? 'text-paper/70' : 'text-muted-foreground'}`}>Cancel whenever you want.</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t-2 border-ink/10 bg-muted py-14">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <h2 className="font-display text-3xl tracking-tight uppercase">More ways to make a mess</h2>
            <p className="mt-4 text-muted-foreground">Build-your-own packs are coming soon. For now, choose a monthly edition and let the paper arrive.</p>
            <Link href="/" className="mt-7 inline-block text-sm font-semibold text-collage-blue underline underline-offset-4">Back to Mundial de Collage</Link>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="faq-title">
          <span className="text-xs font-bold tracking-[0.2em] text-collage-red uppercase">Good to know</span>
          <h2 id="faq-title" className="font-display mt-3 text-3xl tracking-tight uppercase sm:text-4xl">Frequently asked questions</h2>
          <div className="mt-8 divide-y-2 divide-ink/10 border-y-2 border-ink/10">
            <details className="group py-5">
              <summary className="cursor-pointer list-none pr-8 text-base font-bold marker:hidden">Where do you ship?</summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Subscriptions currently ship within Argentina. International shipping will be announced when it is available.</p>
            </details>
            <details className="group py-5">
              <summary className="cursor-pointer list-none pr-8 text-base font-bold marker:hidden">When will my edition arrive?</summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">We assemble each monthly edition by hand. Delivery timing depends on your address and will be shared by email after your subscription is confirmed.</p>
            </details>
            <details className="group py-5">
              <summary className="cursor-pointer list-none pr-8 text-base font-bold marker:hidden">Is shipping included?</summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Shipping is coordinated separately after the subscription is confirmed, so we can use the best option for your location.</p>
            </details>
            <details className="group py-5">
              <summary className="cursor-pointer list-none pr-8 text-base font-bold marker:hidden">How do I cancel?</summary>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">You can cancel whenever you want from your Mercado Pago subscription settings. Your cancellation applies to future monthly charges.</p>
            </details>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
