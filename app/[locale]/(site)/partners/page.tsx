import type { Metadata } from 'next'
import { BookOpen, Box, Check, Mail, Newspaper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { ScrollToTop } from '@/components/scroll-to-top'
import { TrackedAnchor, TrackView } from '@/components/track'
import { site } from '@/lib/site'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.partners.metaTitle, description: m.partners.metaDescription }
}

// Same order as m.partners.places: galería 3D, revista, sitio/newsletter.
const PLACE_ICONS = [Box, BookOpen, Newspaper]

// Brands that want to appear in the gallery, the magazine or the site. There
// is no self-serve checkout: proposals are sent by email, so this page only
// pitches and hands over site.email.
export default async function PartnersPage() {
  const { m } = await getI18n()
  const t = m.partners
  const mailto = `mailto:${site.email}?subject=${encodeURIComponent(t.mailSubject)}`

  return (
    <>
      <ScrollToTop />
      <TrackView event="partners_view" />
      <SiteHeader />
      <main className="bg-grain py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <span className="torn-strip inline-block -rotate-1 bg-collage-red px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase">
            {t.badge}
          </span>
          <h1 className="font-display mt-7 max-w-3xl text-4xl tracking-tight text-ink uppercase sm:text-6xl">{t.title}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{t.intro}</p>

          <section className="mt-12 max-w-3xl -rotate-[0.4deg] rounded-3xl border-2 border-ink/10 bg-collage-blue/5 p-6 sm:p-8" aria-labelledby="partners-about-title">
            <h2 id="partners-about-title" className="font-display text-2xl tracking-tight text-ink uppercase">{t.aboutTitle}</h2>
            <p className="mt-3 text-base leading-relaxed text-foreground">{t.aboutBody}</p>
          </section>

          <section className="mt-14" aria-labelledby="partners-places-title">
            <h2 id="partners-places-title" className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">{t.placesTitle}</h2>
            <ul className="mt-6 grid gap-5 md:grid-cols-3">
              {t.places.map((place, i) => {
                const Icon = PLACE_ICONS[i] ?? Box
                return (
                  <li key={place.title} className="rounded-3xl border-2 border-ink/10 bg-card p-6 shadow-sm">
                    <Icon className="size-8 text-collage-red" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-bold text-ink">{place.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{place.body}</p>
                  </li>
                )
              })}
            </ul>
          </section>

          <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <section aria-labelledby="partners-for-title">
              <h2 id="partners-for-title" className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">{t.forTitle}</h2>
              <ul className="mt-6 space-y-3">
                {t.forList.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-0.5 size-5 shrink-0 text-collage-blue" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border-2 border-ink/10 bg-card p-6 shadow-sm sm:p-8" aria-labelledby="partners-contact-title">
              <Mail className="size-9 text-collage-red" aria-hidden="true" />
              <h2 id="partners-contact-title" className="font-display mt-4 text-2xl tracking-tight text-ink uppercase">{t.contactTitle}</h2>
              <p className="mt-3 text-muted-foreground">
                {t.contactBody.split('{email}').flatMap((part, index) => index === 0
                  ? [part]
                  : [<TrackedAnchor key={index} event="partners_email_click" href={mailto} className="font-semibold text-ink underline underline-offset-2 [overflow-wrap:anywhere]">{site.email}</TrackedAnchor>, part])}
              </p>
              <Button asChild size="lg" className="mt-6 h-auto min-h-14 w-full whitespace-normal py-3">
                <TrackedAnchor event="partners_email_click" href={mailto}>
                  <Mail className="size-4" aria-hidden="true" />
                  {t.contactCta}
                </TrackedAnchor>
              </Button>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
