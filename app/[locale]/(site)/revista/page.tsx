import type { Metadata } from 'next'
import { BookOpen, Check, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { ScrollToTop } from '@/components/scroll-to-top'
import { TrackedLink, TrackView } from '@/components/track'
import { WaitlistSignup } from '@/components/waitlist-signup'
import { MagazineForm } from './magazine-form'
import { getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isMercadoPagoConfigured } from '@/lib/mercadopago'
import { isMagazineSaleOpen, site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.magazine.title, description: m.magazine.intro }
}

// Preventa de la Revista 1ª Edición. Until site.magazine.priceArs is set (or
// Mercado Pago isn't configured), it collects emails instead of selling.
export default async function MagazinePage() {
  const { locale, m } = await getI18n()
  const t = m.magazine
  const priceArs = site.magazine.priceArs
  const selling = isMagazineSaleOpen() && priceArs !== null && isMercadoPagoConfigured

  let defaultName = ''
  let defaultEmail = ''
  if (selling && isSupabaseConfigured) {
    const user = await getCurrentUser()
    defaultName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
    defaultEmail = user?.email ?? ''
  }
  const ars = (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)

  return (
    <>
      <ScrollToTop />
      <TrackView event="magazine_view" />
      <SiteHeader />
      <main className="bg-grain py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <section>
            <span className="torn-strip inline-block -rotate-1 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
              {t.badge}
            </span>
            <h1 className="font-display mt-7 text-4xl tracking-tight text-ink uppercase sm:text-6xl">{t.title}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t.intro}</p>
            <ul className="mt-8 space-y-3">
              {t.points.map((point) => (
                <li key={point} className="flex gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-collage-blue" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm font-semibold text-ink">
              {fmt(t.release, {
                date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(site.magazine.releaseISO)),
              })}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t.shipping}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {site.magazine.shippingAbroadArs !== null
                ? fmt(t.shippingAbroad, { price: ars(site.magazine.shippingAbroadArs) })
                : fmt(t.shippingAbroadSoon, { email: site.email })}
            </p>
          </section>

          <section className="rounded-3xl border-2 border-ink/10 bg-card p-6 shadow-sm sm:p-8" aria-labelledby="magazine-order-title">
            <BookOpen className="size-9 text-collage-red" aria-hidden="true" />
            {selling ? (
              <>
                <h2 id="magazine-order-title" className="font-display mt-4 text-2xl tracking-tight text-ink uppercase">{t.formTitle}</h2>
                <p className="mt-2">
                  <span className="text-3xl font-bold tracking-tight">{ars(priceArs)}</span>{' '}
                  <span className="text-sm text-muted-foreground">{t.perCopy} · {t.priceLabel}</span>
                </p>
                <div className="mt-6">
                  <MagazineForm priceArs={priceArs} shippingAbroadArs={site.magazine.shippingAbroadArs} maxQuantity={site.magazine.maxQuantity} defaultName={defaultName} defaultEmail={defaultEmail} />
                </div>
                {/* Mercado Pago only charges Argentine buyers; abroad orders go by email for now. */}
                {site.magazine.shippingAbroadArs === null && (
                  <div className="mt-8 border-t-2 border-ink/10 pt-6">
                    <h3 className="text-sm font-bold tracking-[0.16em] text-ink uppercase">{t.abroadTitle}</h3>
                    <Button type="button" size="lg" variant="outline" disabled className="mt-3 h-auto min-h-14 w-full whitespace-normal py-3">
                      <Globe className="size-4" aria-hidden="true" />
                      {t.abroadButton}
                    </Button>
                    <p className="mt-3 text-center text-sm text-muted-foreground">
                      {t.abroadBody.split('{email}').flatMap((part, index) => index === 0
                        ? [part]
                        : [<a key={index} href={`mailto:${site.email}?subject=${encodeURIComponent(t.title)}`} className="font-semibold text-ink underline underline-offset-2">{site.email}</a>, part])}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 id="magazine-order-title" className="sr-only">{t.soonTitle}</h2>
                <WaitlistSignup source="revista" title={t.soonTitle} body={t.soonBody} className="mt-4 max-w-none" />
              </>
            )}
          </section>
        </div>
        <aside className="mx-auto mt-14 max-w-6xl px-5 sm:px-8" aria-labelledby="magazine-partners-title">
          <div className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-ink/20 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h2 id="magazine-partners-title" className="font-display text-xl tracking-tight text-ink uppercase">{m.partners.promoTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{m.partners.promoBody}</p>
            </div>
            <TrackedLink href="/partners" event="partners_click_magazine" className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-ink underline underline-offset-4">
              {m.partners.promoCta} →
            </TrackedLink>
          </div>
        </aside>
      </main>
      <Footer showWaitlist={false} />
    </>
  )
}
