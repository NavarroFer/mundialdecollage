import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Globe, Instagram } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { TrackView, TrackedLink } from '@/components/track'
import { Button } from '@/components/ui/button'
import { getArtistProfileBySlug } from '@/lib/artist-profiles'
import { fmt } from '@/lib/i18n/format'
import { getI18n } from '@/lib/i18n/server'
import { getCallState } from '@/lib/call-state'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { ArtistArtworks } from './artist-artworks'

// Public profiles reflect curation immediately and are never built from stale
// data. Params are promises in this project's Next.js version.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [artist, { locale, m }] = await Promise.all([getArtistProfileBySlug(slug), getI18n()])
  if (!artist) return {}

  const firstArtwork = artist.artworks[0]
  const firstTitle = firstArtwork.title ?? m.common.untitled
  const description = fmt(m.meta.artworkDescription, {
    title: firstTitle,
    name: artist.name,
    country: countryCodeToName(artist.countryCode, locale),
  })
  const title = `${artist.name} | Mundial de Collage`

  return {
    title,
    description,
    alternates: { canonical: `/artistas/${artist.slug}` },
    openGraph: {
      title: artist.name,
      description,
      type: 'profile',
      images: [{ url: firstArtwork.imageUrl, alt: fmt(m.common.artworkBy, { title: firstTitle, name: artist.name }) }],
    },
    twitter: {
      card: 'summary_large_image',
      title: artist.name,
      description,
      images: [firstArtwork.imageUrl],
    },
  }
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [artist, { locale, m }, { open: callOpen }] = await Promise.all([getArtistProfileBySlug(slug), getI18n(), getCallState()])
  if (!artist) notFound()

  const country = countryCodeToName(artist.countryCode, locale)

  return (
    <>
      <TrackView event="artist_profile_view" />
      <SiteHeader />
      <main id="top" className="min-h-screen bg-background py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Link
            href="/#participantes"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {m.artwork.back}
          </Link>

          <header className="mt-8 border-b-2 border-ink/10 pb-10 sm:flex sm:items-end sm:justify-between sm:gap-8">
            <div>
              <p className="text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
                {m.participants.eyebrow}
              </p>
              <h1 className="font-display mt-3 text-4xl tracking-tight text-ink uppercase sm:text-6xl">
                {artist.name}
              </h1>
              <p className="mt-4 flex items-center gap-2 text-lg font-semibold text-muted-foreground">
                <span aria-hidden>{countryCodeToFlag(artist.countryCode)}</span>
                {country}
              </p>
            </div>

            {(artist.instagram || artist.website) && (
              <div className="mt-6 flex flex-wrap gap-3 sm:mt-0 sm:justify-end">
                {artist.instagram && (
                  <a
                    href={artist.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30"
                  >
                    <Instagram className="h-4 w-4 text-collage-red" aria-hidden />
                    Instagram
                    <span className="sr-only"> {m.common.opensInNewTab}</span>
                  </a>
                )}
                {artist.website && (
                  <a
                    href={artist.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-4 py-2 text-sm font-semibold text-ink hover:border-ink/30"
                  >
                    <Globe className="h-4 w-4 text-collage-blue" aria-hidden />
                    {m.common.website}
                    <span className="sr-only"> {m.common.opensInNewTab}</span>
                  </a>
                )}
              </div>
            )}
          </header>

          <section className="py-10 sm:py-14" aria-label={m.collage.label}>
            <ArtistArtworks
              artworks={artist.artworks}
              artistName={artist.name}
              untitled={m.common.untitled}
              artworkBy={(title, name) => fmt(m.common.artworkBy, { title, name })}
              techniques={m.common.techniques}
            />
          </section>

          {/* Inviting to participate only while the call is open. */}
          {callOpen && <section className="rounded-3xl border-2 border-ink/10 bg-paper p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-10">
            <div>
              <h2 className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">
                {m.status.joinTitle}
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">{m.status.joinBody}</p>
            </div>
            <Button asChild size="lg" variant="primary" className="mt-6 h-auto min-h-14 whitespace-normal py-3 sm:mt-0">
              <TrackedLink href="/onboarding" event="artist_profile_participate_click">
                {m.status.joinCta}
              </TrackedLink>
            </Button>
          </section>}
        </div>
      </main>
      <Footer />
    </>
  )
}
