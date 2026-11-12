'use client'

/* Supabase Storage URLs vary by environment and are not restricted to one Next Image host. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Heart, MessageCircle } from 'lucide-react'
import { ObraLink } from '@/components/obra-modal'
import type { ArtistProfileArtwork } from '@/lib/artist-profiles'
import { useI18n } from '@/lib/i18n/client'
import { fmt, formatNumber, plural } from '@/lib/i18n/format'
import { imageSrc, imageSrcSet } from '@/lib/image-src'
import { OBRA_LIKED_EVENT } from '@/lib/profile-return'
import { useArtistSocial } from './use-artist-social'

/**
 * Likes and comments of one obra: the cached totals plus the likes given in
 * this visit (the totals refresh every few minutes, so the visitor sees theirs
 * counted right away). undefined while loading, null if it couldn't load.
 */
export function useLiveCounts(slug: string, artworkSlug: string) {
  const social = useArtistSocial(slug)
  const [extra, setExtra] = useState(0)
  useEffect(() => {
    const onLiked = (event: Event) => {
      if ((event as CustomEvent<{ slug: string }>).detail.slug === artworkSlug) setExtra((current) => current + 1)
    }
    window.addEventListener(OBRA_LIKED_EVENT, onLiked)
    return () => window.removeEventListener(OBRA_LIKED_EVENT, onLiked)
  }, [artworkSlug])
  const base = social === undefined ? undefined : social?.artworks[artworkSlug] ?? null
  return { social, counts: base && extra > 0 ? { ...base, likes: base.likes + extra } : base }
}

/** The picture's own proportions, read once it has loaded: no crop, ever. */
function useNaturalRatio() {
  const ref = useRef<HTMLImageElement>(null)
  const [ratio, setRatio] = useState<number>()
  const read = (image: HTMLImageElement | null) => {
    if (image && image.naturalWidth > 0 && image.naturalHeight > 0) setRatio(image.naturalWidth / image.naturalHeight)
  }
  // The picture may be ready before React hydrates, and then onLoad never fires.
  useEffect(() => { read(ref.current) }, [])
  return { ref, ratio, onLoad: (event: React.SyntheticEvent<HTMLImageElement>) => read(event.currentTarget) }
}

type Props = {
  slug: string
  artistName: string
  countryCode: string
  artwork: ArtistProfileArtwork
  /** Degrees; small, so the piece looks pinned and not fallen. */
  tilt?: number
}

function summaryOf({ artwork, artistName, countryCode }: Pick<Props, 'artwork' | 'artistName' | 'countryCode'>) {
  return { slug: artwork.slug, artworkTitle: artwork.title, name: artistName, countryCode, imageUrl: artwork.imageUrl }
}

/**
 * The artist's lead obra: large, whole, taped to the colour field, with its
 * title on a paper label hanging underneath. One link opens it in the popup,
 * where anyone can like and comment (components/obra-social.tsx).
 */
export function HeroPiece({ slug, artistName, countryCode, artwork, tilt = -1.5 }: Props) {
  const { m } = useI18n()
  const { ref, ratio, onLoad } = useNaturalRatio()
  const title = artwork.title ?? m.common.untitled
  return (
    <figure
      className="mx-auto w-full rotate-(--tilt) motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:hover:rotate-0"
      // Whole picture within ~62% of the screen's height, whatever its shape.
      style={{ '--tilt': `${tilt}deg`, maxWidth: ratio ? `calc(${ratio.toFixed(3)} * 62vh + 1.5rem)` : undefined } as React.CSSProperties}
    >
      <ObraLink
        obra={summaryOf({ artwork, artistName, countryCode })}
        interactive
        className="group relative block bg-paper p-2 shadow-[0_22px_32px_-14px_rgb(27_17_12/0.55)] focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--paper),0_0_0_7px_var(--ink)] sm:p-3"
      >
        <span aria-hidden className="tape -top-3 left-6 -rotate-[32deg]" />
        <span aria-hidden className="tape -top-3 right-6 rotate-[28deg]" />
        <img
          ref={ref}
          onLoad={onLoad}
          src={imageSrc(artwork.imageUrl, 1200)}
          srcSet={imageSrcSet(artwork.imageUrl, 1600)}
          sizes="(min-width: 1024px) 640px, 92vw"
          decoding="async"
          fetchPriority="high"
          alt={fmt(m.common.artworkBy, { title, name: artistName })}
          className="block h-auto w-full bg-muted"
          style={ratio ? { aspectRatio: ratio } : { aspectRatio: '1 / 1' }}
        />
        <span className="mt-3 flex items-end justify-between gap-4 px-1 pb-1 text-ink">
          <span className="min-w-0">
            <span className="font-display block text-2xl leading-none tracking-tight break-words uppercase sm:text-3xl">{title}</span>
            {artwork.technique && (
              <span className="mt-1.5 block text-sm font-semibold text-muted-foreground">
                {m.common.techniques[artwork.technique] ?? artwork.technique}
              </span>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-collage-blue underline-offset-4 group-hover:underline">
            {m.gallery.viewArtwork}
            <ArrowUpRight aria-hidden className="size-4" strokeWidth={2.5} />
          </span>
        </span>
      </ObraLink>
    </figure>
  )
}

// Each piece of the wall leans a little differently, in a fixed order so the
// server and the browser agree and the wall doesn't shuffle on every visit.
const TILTS = [-1.6, 1.1, -0.6, 1.8, -1.2, 0.7]

/** One obra on the wall: whole, framed in paper, held by tape, with its response on a sticker. */
export function WallPiece({ slug, artistName, countryCode, artwork, index }: Omit<Props, 'tilt'> & { index: number }) {
  const { locale, m } = useI18n()
  const t = m.artistProfile
  const { counts } = useLiveCounts(slug, artwork.slug)
  const { ref, ratio, onLoad } = useNaturalRatio()
  const title = artwork.title ?? m.common.untitled
  const countText = counts ? `${plural(locale, counts.likes, t.likes)}, ${plural(locale, counts.comments, t.comments)}` : ''
  return (
    <figure
      className="relative rotate-(--tilt) motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-0"
      style={{ '--tilt': `${TILTS[index % TILTS.length]}deg` } as React.CSSProperties}
    >
      <ObraLink
        obra={summaryOf({ artwork, artistName, countryCode })}
        interactive
        className="relative block bg-paper p-2 pb-3 shadow-[0_14px_22px_-12px_rgb(27_17_12/0.5)] ring-1 ring-ink/10 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-collage-blue"
      >
        {index % 2 === 0
          ? <span aria-hidden className="tape -top-3 left-1/2 -translate-x-1/2 rotate-[-4deg]" />
          : <>
              <span aria-hidden className="tape -top-2.5 -left-4 -rotate-[38deg]" />
              <span aria-hidden className="tape -top-2.5 -right-4 rotate-[38deg]" />
            </>}
        <img
          ref={ref}
          onLoad={onLoad}
          src={imageSrc(artwork.imageUrl, 640)}
          srcSet={imageSrcSet(artwork.imageUrl, 640)}
          sizes="(min-width: 1024px) 330px, (min-width: 640px) 45vw, 92vw"
          loading="lazy"
          decoding="async"
          alt={fmt(m.common.artworkBy, { title, name: artistName })}
          className="block h-auto w-full bg-muted"
          style={{ aspectRatio: ratio ?? '4 / 5' }}
        />
        <span className="mt-2 block px-1 text-sm font-bold text-ink [overflow-wrap:anywhere]">{title}</span>
        <span className="sr-only">{countText}</span>
      </ObraLink>
      {counts && (
        <span aria-hidden className="absolute -right-2 -bottom-3 flex -rotate-3 gap-2.5 rounded-full bg-collage-red px-3 py-1 text-sm font-bold text-paper shadow-sm">
          <span className="inline-flex items-center gap-1"><Heart className="size-3.5 fill-current" />{formatNumber(locale, counts.likes)}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5 fill-current" />{formatNumber(locale, counts.comments)}</span>
        </span>
      )}
    </figure>
  )
}
