import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye, Globe, Instagram } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { TrackView, TrackedLink } from '@/components/track'
import { Button } from '@/components/ui/button'
import { artistProfileIdFromSlug, getArtistProfileBySlug, getOwnArtistPreview } from '@/lib/artist-profiles'
import { getCurrentUser } from '@/lib/supabase/server'
import { fmt } from '@/lib/i18n/format'
import { getI18n } from '@/lib/i18n/server'
import { getCallState } from '@/lib/call-state'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { imageSrc } from '@/lib/image-src'
import { ArtistFeed } from './artist-feed'
import { ArtistStats } from './artist-stats'
import { ShareProfile } from './share-profile'
import { BioLink } from './bio-link'
import { ClubOnProfile } from './club-on-profile'
import { isClubOpen } from '@/lib/club-launch'

// Public profiles reflect curation immediately and are never built from stale
// data. Params are promises in this project's Next.js version.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [artist, { locale, m }] = await Promise.all([getArtistProfileBySlug(slug), getI18n()])
  // An unpublished profile is only its owner's preview: keep it out of search.
  if (!artist) return { robots: { index: false, follow: false } }

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
  const [publicArtist, { locale, m }, { open: callOpen }] = await Promise.all([getArtistProfileBySlug(slug), getI18n(), getCallState()])
  // Before an admin publishes it, the artist alone sees their own profile as a
  // preview. The anon copy has no user, so it still 404s and stays static.
  // getCurrentUser() is null in the anon copy, so that one stays static.
  const viewer = await getCurrentUser()
  const preview = publicArtist ? undefined : await getOwnArtistPreview(slug, viewer?.id)
  const artist = publicArtist ?? preview
  if (!artist) notFound()
  const clubTexts = {
    eyebrow: m.clubLanding.homeEyebrow,
    title: m.clubLanding.homeTitle,
    body: m.clubLanding.homeBody,
    cta: m.clubLanding.homeCta,
    enter: m.clubLanding.mapEnter,
  }
  const isOwn = Boolean(viewer && artistProfileIdFromSlug(artist.slug) === viewer.id.toLowerCase())

  const country = countryCodeToName(artist.countryCode, locale)

  return (
    <>
      <TrackView event="artist_profile_view" />
      <SiteHeader />
      <main id="top" className="min-h-screen bg-background py-12 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-8">
          <Link
            href="/#participantes"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {m.artwork.back}
          </Link>

          {preview && (
            <p role="status" className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-collage-blue/30 bg-collage-blue/5 p-4 text-sm text-ink">
              <Eye className="mt-0.5 h-5 w-5 shrink-0 text-collage-blue" aria-hidden />
              <span><strong className="font-semibold">{m.artistProfile.previewTitle}</strong> {m.artistProfile.previewBody}</span>
            </p>
          )}

          {/* Laid out like an Instagram profile: picture, name, counters, links. */}
          <header className="mt-8 flex flex-col items-center gap-6 pb-8 text-center sm:flex-row sm:items-center sm:gap-12 sm:text-left">
            <div className="shrink-0 rounded-full bg-[conic-gradient(var(--collage-yellow),var(--collage-red),var(--collage-blue),var(--collage-yellow))] p-1">
              {/* The latest obra stands in for a profile picture: artists don't upload one. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc(artist.artworks[0].imageUrl, 384)}
                alt=""
                decoding="async"
                fetchPriority="high"
                className="h-28 w-28 rounded-full border-4 border-background object-cover sm:h-36 sm:w-36"
              />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
                {m.participants.eyebrow}
              </p>
              <h1 className="font-display mt-2 text-4xl tracking-tight break-words text-ink uppercase sm:text-5xl">
                {artist.name}
              </h1>
              <p className="mt-2 flex items-center justify-center gap-2 text-lg font-semibold text-muted-foreground sm:justify-start">
                <span aria-hidden>{countryCodeToFlag(artist.countryCode)}</span>
                {country}
              </p>

              <div className="mt-5 flex justify-center sm:justify-start">
                <ArtistStats slug={artist.slug} artworkCount={artist.artworks.length} />
              </div>

              {(artist.instagram || artist.website) && (
                <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
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
            </div>
          </header>

          <div className="empty:hidden pb-8">
            <ClubOnProfile slug={artist.slug} name={artist.name} isOwn={isOwn} clubOpen={isClubOpen()} show="gallery" texts={clubTexts} />
          </div>

          <section className="pb-10 sm:pb-14" aria-label={m.collage.label}>
            <ArtistFeed
              slug={artist.slug}
              artistName={artist.name}
              countryCode={artist.countryCode}
              artworks={artist.artworks}
            />
          </section>

          {/* An unpublished profile's link would 404 for everyone else. */}
          {!preview && (
            <section className="flex flex-col gap-5 pb-10 sm:pb-14">
              <ShareProfile slug={artist.slug} name={artist.name} artworkSlug={artist.artworks[0].slug} isOwn={isOwn} />
              {isOwn && <BioLink slug={artist.slug} />}
              <ClubOnProfile slug={artist.slug} name={artist.name} isOwn={isOwn} clubOpen={isClubOpen()} show="invite" texts={clubTexts} />
            </section>
          )}

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
