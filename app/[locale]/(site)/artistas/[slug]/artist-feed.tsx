'use client'

/* Supabase Storage URLs vary by environment and are not restricted to one Next Image host. */
/* eslint-disable @next/next/no-img-element */

import { useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { ObraLink, useOpenObra } from '@/components/obra-modal'
import type { ArtistProfileArtwork } from '@/lib/artist-profiles'
import type { ArtistSocial } from '@/lib/artist-social'
import type { ArtworkSummary } from '@/lib/finalists'
import { useI18n } from '@/lib/i18n/client'
import { fmt, formatDayMonth } from '@/lib/i18n/format'
import { imageSrc } from '@/lib/image-src'
import { armProfileReturn, readProfileReturn, withoutReturnParams } from '@/lib/profile-return'
import { WallPiece } from './collage-piece'
import { useArtistSocial } from './use-artist-social'

// What sits under the lead obra: the rest of the artist's work as a wall of
// pieces (only when there is more than one obra), and the comments their obras
// received as notes pinned beside it. Clicking an obra opens it in the popup,
// where anyone can like it and comment (components/obra-social.tsx).
export function ArtistFeed({
  slug,
  artistName,
  countryCode,
  artworks,
}: {
  slug: string
  artistName: string
  countryCode: string
  artworks: ArtistProfileArtwork[]
}) {
  const { m } = useI18n()
  const social = useArtistSocial(slug)
  const openObra = useOpenObra()
  const t = m.artistProfile
  const more = artworks.slice(1)

  // Back from Google after liking or commenting here: reopen that obra, where
  // the action finishes. The address is read in the browser (this page is
  // static) and cleaned so a reload doesn't repeat it.
  useEffect(() => {
    const back = readProfileReturn(window.location.search)
    if (!back) return
    const artwork = artworks.find((candidate) => candidate.slug === back.slug)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${withoutReturnParams(window.location.search)}${window.location.hash}`)
    if (!artwork || !openObra) return
    armProfileReturn(back)
    openObra({ slug: artwork.slug, artworkTitle: artwork.title, name: artistName, countryCode, imageUrl: artwork.imageUrl }, { interactive: true })
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = (artwork: ArtistProfileArtwork) => ({
    slug: artwork.slug, artworkTitle: artwork.title, name: artistName, countryCode, imageUrl: artwork.imageUrl,
  })

  return (
    <div className="space-y-16 sm:space-y-20">
      {more.length > 0 && (
        <section aria-labelledby="wall-title">
          <h2 id="wall-title" className="font-display text-3xl tracking-tight text-ink uppercase sm:text-4xl">{t.moreWork}</h2>
          {/* Columns, not a grid: every piece keeps its own proportions and the wall fills like a wall. */}
          <ul className="mt-6 columns-1 gap-x-4 bg-muted px-2 pt-6 pb-2 sm:columns-2 sm:px-6 lg:columns-3">
            {more.map((artwork, index) => (
              <li key={artwork.slug} className="break-inside-avoid px-4 pt-6 pb-10">
                <WallPiece slug={slug} artistName={artistName} countryCode={countryCode} artwork={artwork} index={index} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="notes-title">
        <h2 id="notes-title" className="font-display text-3xl tracking-tight text-ink uppercase sm:text-4xl">{t.tabComments}</h2>
        <div className="mt-6">
          <Comments social={social} artworks={artworks} summary={summary} />
        </div>
        {social === null && <p className="mt-4 text-sm text-muted-foreground" role="status">{t.loadError}</p>}
      </section>
    </div>
  )
}

const NOTE_TILTS = ['-rotate-1', 'rotate-[0.6deg]', '-rotate-[0.4deg]', 'rotate-1']

function Comments({
  social,
  artworks,
  summary,
}: {
  social: ArtistSocial | null | undefined
  artworks: ArtistProfileArtwork[]
  summary: (artwork: ArtistProfileArtwork) => ArtworkSummary
}) {
  const { locale, m } = useI18n()
  const t = m.artistProfile

  if (social === undefined) {
    return (
      <ul className="space-y-4" aria-busy>
        {[0, 1].map((i) => (
          <li key={i} className="flex gap-3 bg-paper p-4 shadow-sm">
            <span className="size-12 shrink-0 rounded-sm bg-muted motion-safe:animate-pulse" />
            <span className="h-12 flex-1 rounded-sm bg-muted motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    )
  }
  // The caller already says the likes and comments couldn't load.
  if (social === null) return null

  const bySlug = new Map(artworks.map((artwork) => [artwork.slug, artwork]))
  const comments = social.comments.filter((comment) => bySlug.has(comment.artworkSlug))

  if (comments.length === 0) {
    return (
      <div className="max-w-md -rotate-1 bg-paper p-6 shadow-[0_14px_22px_-14px_rgb(27_17_12/0.5)] ring-1 ring-ink/10">
        <MessageCircle className="size-8 text-collage-blue" aria-hidden />
        <p className="mt-3 text-lg text-ink">{t.noComments}</p>
        <ObraLink
          obra={summary(artworks[0])}
          interactive
          className="mt-5 inline-flex min-h-12 items-center rounded-full border-2 border-ink px-5 py-2 text-base font-bold text-ink hover:bg-ink hover:text-paper focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-collage-blue"
        >
          {m.gallery.comments.action}
        </ObraLink>
      </div>
    )
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2">
      {comments.map((comment, index) => {
        const artwork = bySlug.get(comment.artworkSlug)!
        const title = artwork.title ?? m.common.untitled
        return (
          <li key={comment.id} className={`${NOTE_TILTS[index % NOTE_TILTS.length]} flex gap-3 bg-paper p-4 shadow-[0_12px_20px_-14px_rgb(27_17_12/0.5)] ring-1 ring-ink/10`}>
            <ObraLink obra={summary(artwork)} interactive className="shrink-0 rounded-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
              <img
                src={imageSrc(artwork.imageUrl, 128)}
                alt={title}
                loading="lazy"
                decoding="async"
                className="size-12 rounded-sm object-cover"
              />
            </ObraLink>
            <div className="min-w-0">
              <p className="text-base break-words text-ink">
                <strong className="font-bold">{comment.author}</strong> {comment.body}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {fmt(t.onArtwork, { title })} · <time dateTime={comment.createdAt}>{formatDayMonth(locale, comment.createdAt)}</time>
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
