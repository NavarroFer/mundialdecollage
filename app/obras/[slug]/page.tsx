import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Globe, Instagram } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { ShareArtwork } from '@/components/share-artwork'
import { countryCodeToFlag } from '@/lib/participants'
import { countryCodeToName, getArtworkShareState, getFinalistBySlug } from '@/lib/finalists'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'

// Slugs come from live submissions, so pages render on demand per request
// instead of at build time.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [finalist, { locale, m }] = await Promise.all([getFinalistBySlug(slug), getI18n()])
  if (!finalist) return {}
  const title = finalist.artworkTitle ?? m.common.untitled

  const description = fmt(m.meta.artworkDescription, {
    title,
    name: finalist.name,
    country: countryCodeToName(finalist.countryCode, locale),
  })
  // Without these the link preview would keep the home's title and text
  // around this obra's own image (opengraph-image.tsx).
  const shareTitle = `${title} — ${finalist.name}`
  return {
    title: `${shareTitle} | Mundial de Collage`,
    description,
    openGraph: { title: shareTitle, description, type: 'article' },
    twitter: { card: 'summary_large_image', title: shareTitle, description },
  }
}

export default async function ObraPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [finalist, { locale, m }, shareState] = await Promise.all([
    getFinalistBySlug(slug),
    getI18n(),
    getArtworkShareState(slug),
  ])

  if (!finalist) notFound()
  const title = finalist.artworkTitle ?? m.common.untitled

  return (
    <>
      <SiteHeader />
      <main className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Link
            href="/#participantes"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            {m.artwork.back}
          </Link>

          <div className="mt-8 overflow-hidden rounded-2xl border-2 border-ink/10 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={finalist.imageUrl}
              alt={fmt(m.common.artworkBy, { title, name: finalist.name })}
              className="w-full object-cover"
            />
          </div>

          <div className="mt-8">
            <p className="text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
              {finalist.technique && (m.common.techniques[finalist.technique] ?? finalist.technique)}
            </p>
            <h1 className="font-display mt-2 text-3xl tracking-tight text-ink uppercase sm:text-5xl">
              {title}
            </h1>

            <p className="mt-5 flex items-center gap-2 text-lg font-semibold text-ink">
              <span aria-hidden>{countryCodeToFlag(finalist.countryCode)}</span>
              {finalist.name}
            </p>
            <p className="text-muted-foreground">{countryCodeToName(finalist.countryCode, locale)}</p>

            {(finalist.instagram || finalist.website) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {finalist.instagram && (
                  <a
                    href={finalist.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30"
                  >
                    <Instagram className="h-4 w-4 text-collage-red" />
                    Instagram
                  </a>
                )}
                {finalist.website && (
                  <a
                    href={finalist.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30"
                  >
                    <Globe className="h-4 w-4 text-collage-blue" />
                    {m.common.website}
                  </a>
                )}
              </div>
            )}

            <div className="mt-10">
              <ShareArtwork slug={finalist.slug} title={title} name={finalist.name} {...shareState} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
