import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Eye, Globe, Instagram } from 'lucide-react'
import { Footer } from '@/components/footer'
import { SiteHeader } from '@/components/site-header'
import { TrackView, TrackedLink } from '@/components/track'
import { artistProfileIdFromSlug, getArtistProfileBySlug, getOwnArtistPreview } from '@/lib/artist-profiles'
import { getCurrentUser } from '@/lib/supabase/server'
import { fmt } from '@/lib/i18n/format'
import { getI18n } from '@/lib/i18n/server'
import { getCallState } from '@/lib/call-state'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { CommunityFeed } from '@/components/community/community-feed'
import { ArtistFeed } from './artist-feed'
import { HeroPiece } from './collage-piece'
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

// Each artist gets one colour field, always the same one: derived from their id.
const FIELDS = [
  { bg: 'bg-collage-blue', ink: 'text-paper', back: 'hover:text-paper/80' },
  { bg: 'bg-collage-red', ink: 'text-paper', back: 'hover:text-paper/80' },
  { bg: 'bg-collage-yellow', ink: 'text-ink', back: 'hover:text-ink/70' },
] as const

function fieldFor(slug: string) {
  const id = artistProfileIdFromSlug(slug) ?? slug
  let sum = 0
  for (const char of id) sum += char.charCodeAt(0)
  return FIELDS[sum % FIELDS.length]
}

// Display type scales down with the length of the name, not with the screen alone.
function nameSize(name: string) {
  if (name.length > 44) return 'text-3xl sm:text-4xl lg:text-5xl'
  if (name.length > 24) return 'text-4xl sm:text-5xl lg:text-6xl'
  return 'text-5xl sm:text-6xl lg:text-[6rem]'
}

const note = 'inline-flex min-h-11 items-center gap-2 bg-paper px-4 py-2 text-sm font-bold text-ink shadow-[0_8px_12px_-8px_rgb(27_17_12/0.55)] motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--paper),0_0_0_7px_var(--ink)]'

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
  const field = fieldFor(artist.slug)

  return (
    <>
      <TrackView event="artist_profile_view" />
      <SiteHeader />
      <main id="top" className="min-h-screen bg-background pb-12 sm:pb-20">
        {/* The colour field: one sheet of paper torn along its lower edge, with grain. */}
        <section className="relative isolate pb-14 lg:pb-20">
          <div aria-hidden className="absolute inset-x-0 top-0 bottom-14 -z-10 drop-shadow-[0_8px_8px_rgb(27_17_12/0.22)] lg:bottom-20">
            <div className={`${field.bg} torn-b relative h-full`}>
              <span className="grain-overlay absolute inset-0 pointer-events-none" />
            </div>
          </div>

          <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-8 sm:pt-8">
            <Link
              href="/explorar"
              className={`inline-flex min-h-11 items-center gap-2 text-sm font-bold ${field.ink} ${field.back} focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-current`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {m.artwork.back}
            </Link>

            {preview && (
              <p role="status" className="mt-4 flex max-w-2xl items-start gap-3 bg-paper p-4 text-sm text-ink shadow-sm">
                <Eye className="mt-0.5 h-5 w-5 shrink-0 text-collage-blue" aria-hidden />
                <span><strong className="font-semibold">{m.artistProfile.previewTitle}</strong> {m.artistProfile.previewBody}</span>
              </p>
            )}

            <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
              {/* The latest obra stands for the artist: they don't upload a picture of themselves. */}
              <HeroPiece slug={artist.slug} artistName={artist.name} countryCode={artist.countryCode} artwork={artist.artworks[0]} />

              <div className={`min-w-0 ${field.ink}`}>
                <h1 className={`font-display leading-[0.92] tracking-tight text-balance break-words uppercase ${nameSize(artist.name)}`}>
                  {artist.name}
                </h1>

                {/* A rubber stamp: the country, as on a postmark. */}
                <p className="mt-6 inline-flex -rotate-[5deg] items-center gap-3 border-[3px] border-double border-current px-4 py-1.5 font-display text-2xl tracking-wide uppercase">
                  <span aria-hidden className="text-3xl leading-none">{countryCodeToFlag(artist.countryCode)}</span>
                  {country}
                </p>

                <div className="mt-8">
                  <ArtistStats slug={artist.slug} artworkCount={artist.artworks.length} />
                </div>

                {/* Sharing is what an artist does with their profile: it sits with the other actions, not at the bottom. */}
                <div className="mt-8 flex flex-wrap gap-4 empty:hidden">
                  {artist.instagram && (
                    <a href={artist.instagram} target="_blank" rel="noopener noreferrer" className={`${note} -rotate-1`}>
                      <Instagram className="h-4 w-4 text-collage-red" aria-hidden />
                      Instagram
                      <span className="sr-only"> {m.common.opensInNewTab}</span>
                    </a>
                  )}
                  {artist.website && (
                    <a href={artist.website} target="_blank" rel="noopener noreferrer" className={`${note} rotate-1`}>
                      <Globe className="h-4 w-4 text-collage-blue" aria-hidden />
                      {m.common.website}
                      <span className="sr-only"> {m.common.opensInNewTab}</span>
                    </a>
                  )}
                  {/* An unpublished profile's link would 404 for everyone else. */}
                  {!preview && <ShareProfile compact slug={artist.slug} name={artist.name} artworkSlug={artist.artworks[0].slug} isOwn={isOwn} />}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-8 sm:pt-8">
          <div className="empty:hidden pb-10">
            <ClubOnProfile slug={artist.slug} name={artist.name} isOwn={isOwn} clubOpen={isClubOpen()} show="gallery" texts={clubTexts} />
          </div>

          {artistProfileIdFromSlug(artist.slug) && (
            <div className="pb-10 sm:pb-14">
              <CommunityFeed author={artistProfileIdFromSlug(artist.slug)} callOpen={callOpen} hideEmpty title={m.community.artistPosts} />
            </div>
          )}

          <section className="pb-10 sm:pb-14" aria-label={m.collage.label}>
            <ArtistFeed
              slug={artist.slug}
              artistName={artist.name}
              countryCode={artist.countryCode}
              artworks={artist.artworks}
            />
          </section>

          {!preview && (
            <section className="flex flex-col gap-5 pb-10 empty:hidden sm:pb-14">
              {isOwn && <BioLink slug={artist.slug} />}
              <ClubOnProfile slug={artist.slug} name={artist.name} isOwn={isOwn} clubOpen={isClubOpen()} show="invite" texts={clubTexts} />
            </section>
          )}

          {/* Inviting to participate only while the call is open. */}
          {callOpen && (
            <section className={`${field.bg} ${field.ink} relative -rotate-[0.6deg] p-6 shadow-[0_18px_28px_-16px_rgb(27_17_12/0.6)] sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-10`}>
              <div>
                <h2 className="font-display text-2xl tracking-tight uppercase sm:text-3xl">{m.status.joinTitle}</h2>
                <p className="mt-2 max-w-xl text-base">{m.status.joinBody}</p>
              </div>
              <TrackedLink
                href="/onboarding"
                event="artist_profile_participate_click"
                className="mt-6 inline-flex min-h-14 items-center justify-center rounded-full bg-paper px-8 py-3 text-center text-base font-bold text-ink hover:bg-ink hover:text-paper focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-current sm:mt-0"
              >
                {m.status.joinCta}
              </TrackedLink>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
