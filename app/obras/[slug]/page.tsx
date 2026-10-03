import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Globe, Instagram } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Footer } from '@/components/footer'
import { StorePromo } from '@/components/store-promo'
import { getCallState } from '@/lib/call-state'
import { ShareArtwork } from '@/components/share-artwork'
import { ReferralInvite } from '@/components/referral-invite'
import { TrackView, TrackedLink } from '@/components/track'
import { ScrollToTop } from '@/components/scroll-to-top'
import { Button } from '@/components/ui/button'
import { countryCodeToFlag } from '@/lib/participants'
import { countryCodeToName, getArtworkShareState, getFinalistBySlug, getFinalists } from '@/lib/finalists'
import { artistProfileSlug } from '@/lib/artist-profiles'
import { getI18n } from '@/lib/i18n/server'
import { fmt } from '@/lib/i18n/format'
import { imageSrc } from '@/lib/image-src'

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

export default async function ObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ref?: string | string[] }>
}) {
  const [{ slug }, { ref }] = await Promise.all([params, searchParams])
  const [finalist, { locale, m }, shareState, finalists, { open: callOpen }] = await Promise.all([
    getFinalistBySlug(slug),
    getI18n(),
    getArtworkShareState(slug),
    getFinalists(),
    getCallState(),
  ])

  if (!finalist) notFound()
  const title = finalist.artworkTitle ?? m.common.untitled
  const artistHref = `/artistas/${artistProfileSlug(finalist.name, finalist.profileId)}`
  const relatedArtworks = finalists
    .filter((artwork) => artwork.profileId === finalist.profileId && artwork.slug !== finalist.slug)
    .slice(0, 3)
  const currentIndex = finalists.findIndex((artwork) => artwork.slug === finalist.slug)
  const previousArtwork = currentIndex > 0 ? finalists[currentIndex - 1] : undefined
  const nextArtwork = currentIndex >= 0 && currentIndex < finalists.length - 1
    ? finalists[currentIndex + 1]
    : undefined

  return (
    <>
      <TrackView event="artwork_page_view" />
      <ScrollToTop />
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

          {/* Most visitors here came through the link its artist shared. */}
          <ReferralInvite refParam={ref} className="mt-6" />

          <div className="mt-8 overflow-hidden rounded-2xl border-2 border-ink/10 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc(finalist.imageUrl, 1200)}
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
              <TrackedLink
                href={artistHref}
                event="artwork_artist_profile_click"
                className="underline decoration-2 underline-offset-4 hover:text-collage-blue"
              >
                {finalist.name}
              </TrackedLink>
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

          {relatedArtworks.length > 0 && (
            <section className="mt-14 border-t-2 border-ink/10 pt-10" aria-labelledby="related-artworks-title">
              <h2 id="related-artworks-title" className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">
                {m.collage.label} — {finalist.name}
              </h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                {relatedArtworks.map((artwork) => {
                  const artworkTitle = artwork.artworkTitle ?? m.common.untitled
                  return (
                    <Link key={artwork.slug} href={`/obras/${artwork.slug}`} className="group overflow-hidden rounded-2xl border-2 border-ink/10 bg-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageSrc(artwork.imageUrl, 640)}
                        alt={fmt(m.common.artworkBy, { title: artworkTitle, name: artwork.name })}
                        className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                      <p className="p-4 font-semibold text-ink group-hover:text-collage-blue">{artworkTitle}</p>
                    </Link>
                  )
                })}
              </div>
              <TrackedLink
                href={artistHref}
                event="artwork_artist_profile_click"
                className="mt-5 inline-flex min-h-11 items-center font-semibold text-collage-blue underline underline-offset-4"
              >
                {finalist.name}
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </TrackedLink>
            </section>
          )}

          {(previousArtwork || nextArtwork) && (
            <nav className="mt-14 grid grid-cols-2 gap-3 border-t-2 border-ink/10 pt-8" aria-label={m.collage.label}>
              {previousArtwork ? (
                <Link
                  href={`/obras/${previousArtwork.slug}`}
                  className="flex min-h-20 items-center gap-3 rounded-2xl border-2 border-ink/10 bg-card p-4 text-sm font-semibold text-ink hover:border-ink/25"
                >
                  <ArrowLeft className="size-5 shrink-0 text-collage-blue" aria-hidden="true" />
                  <span className="line-clamp-2">{previousArtwork.artworkTitle ?? m.common.untitled}</span>
                </Link>
              ) : <span />}
              {nextArtwork && (
                <Link
                  href={`/obras/${nextArtwork.slug}`}
                  className="flex min-h-20 items-center justify-end gap-3 rounded-2xl border-2 border-ink/10 bg-card p-4 text-right text-sm font-semibold text-ink hover:border-ink/25"
                >
                  <span className="line-clamp-2">{nextArtwork.artworkTitle ?? m.common.untitled}</span>
                  <ArrowRight className="size-5 shrink-0 text-collage-blue" aria-hidden="true" />
                </Link>
              )}
            </nav>
          )}

          {/* Inviting to participate only while the call is open. */}
          {callOpen && <section className="mt-14 rounded-3xl border-2 border-ink/10 bg-paper p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-10">
            <div>
              <h2 className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">
                {m.status.joinTitle}
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">{m.status.joinBody}</p>
            </div>
            <Button asChild size="lg" variant="primary" className="mt-6 h-auto min-h-14 whitespace-normal py-3 sm:mt-0">
              <TrackedLink href="/onboarding" event="artwork_participate_click">
                {m.status.joinCta}
              </TrackedLink>
            </Button>
          </section>}

          <StorePromo m={m} event="store_click_artwork" className="mt-6" />
        </div>
      </main>
      <Footer />
    </>
  )
}
