import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { TrackView } from '@/components/track'
import { Button } from '@/components/ui/button'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.donationThanks.metaTitle, robots: { index: false } }
}

// Where Mercado Pago or PayPal sends a donor back (app/[locale]/(site)/donar/
// actions.ts): paid, or a cash payment still to be made. Nothing here is the donor's, so
// it's the same page for everyone and the CDN serves it.
export default async function DonationThanksPage() {
  const { m } = await getI18n()
  const t = m.donationThanks
  return (
    <>
      <TrackView event="donation_thanks_view" />
      <SiteHeader />
      <main>
        <section className="bg-grain relative overflow-hidden py-24 sm:py-32">
          <div className="relative mx-auto max-w-2xl px-5 text-center sm:px-8">
            <span className="torn-strip inline-block -rotate-2 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
              {t.badge}
            </span>
            <h1 className="font-display mt-8 text-4xl tracking-tight text-ink uppercase sm:text-5xl">{t.title}</h1>
            <p className="mx-auto mt-6 max-w-md text-lg text-muted-foreground">{t.body}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t.pending}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg"><Link href="/">{m.common.backHome}</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/galeria-3d">{t.gallery}</Link></Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
