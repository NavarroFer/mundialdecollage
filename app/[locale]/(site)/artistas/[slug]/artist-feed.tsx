'use client'

/* Supabase Storage URLs vary by environment and are not restricted to one Next Image host. */
/* eslint-disable @next/next/no-img-element */

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Grid3x3, Heart, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { ObraLink } from '@/components/obra-modal'
import type { ArtistProfileArtwork } from '@/lib/artist-profiles'
import type { ArtistSocial } from '@/lib/artist-social'
import type { ArtworkSummary } from '@/lib/finalists'
import { galleryArtworkPath } from '@/lib/gallery-return'
import { useI18n } from '@/lib/i18n/client'
import { fmt, formatDayMonth, formatNumber, plural } from '@/lib/i18n/format'
import { imageSrc, imageSrcSet } from '@/lib/image-src'
import { useArtistSocial } from './use-artist-social'

type Tab = 'artworks' | 'comments'
const TABS: Tab[] = ['artworks', 'comments']

// The artist's obras as an Instagram profile shows posts: a square grid with
// each obra's likes and comments, and next to it a tab with the latest
// comments their obras received. Clicking an obra opens it in the popup.
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
  const [tab, setTab] = useState<Tab>('artworks')
  const id = useId()
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ artworks: null, comments: null })
  const t = m.artistProfile
  const single = artworks.length === 1

  const summary = (artwork: ArtistProfileArtwork) => ({
    slug: artwork.slug, artworkTitle: artwork.title, name: artistName, countryCode, imageUrl: artwork.imageUrl,
  })

  // Arrow keys move between tabs, as WAI-ARIA tabs expect.
  function onTabKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = TABS[(TABS.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  const labels: Record<Tab, { text: string; Icon: typeof Grid3x3 }> = {
    artworks: { text: t.tabArtworks, Icon: Grid3x3 },
    comments: { text: t.tabComments, Icon: MessageCircle },
  }

  return (
    <div>
      <div role="tablist" aria-label={t.tabsLabel} className="flex justify-center gap-10 border-t-2 border-ink/10" onKeyDown={onTabKey}>
        {TABS.map((key) => {
          const { text, Icon } = labels[key]
          const selected = tab === key
          return (
            <button
              key={key}
              ref={(node) => { tabRefs.current[key] = node }}
              type="button"
              role="tab"
              id={`${id}-${key}-tab`}
              aria-selected={selected}
              aria-controls={`${id}-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(key)}
              className={`-mt-0.5 inline-flex min-h-12 items-center gap-2 border-t-2 px-1 text-sm font-bold tracking-[0.15em] uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue motion-reduce:transition-none ${
                selected ? 'border-ink text-ink' : 'border-transparent text-muted-foreground hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {text}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`${id}-artworks`} aria-labelledby={`${id}-artworks-tab`} hidden={tab !== 'artworks'} className="pt-4">
        {/* A single obra fills the column, like an open post; more go in the grid. */}
        <ul className={single ? 'mx-auto max-w-xl' : 'grid grid-cols-3 gap-1 sm:gap-2'}>
          {artworks.map((artwork) => (
            <li key={artwork.slug}>
              <ArtworkTile
                artwork={artwork}
                obra={summary(artwork)}
                alt={fmt(m.common.artworkBy, { title: artwork.title ?? m.common.untitled, name: artistName })}
                counts={social === undefined ? undefined : social?.artworks[artwork.slug] ?? null}
                large={single}
              />
              {/* The open post's caption: what the grid leaves to the popup. */}
              {single && (
                <div className="mt-4">
                  {artwork.technique && (
                    <p className="text-xs font-bold tracking-[0.2em] text-collage-red uppercase">
                      {m.common.techniques[artwork.technique] ?? artwork.technique}
                    </p>
                  )}
                  <h2 className="font-display mt-1 text-2xl tracking-tight text-ink uppercase">
                    {artwork.title ?? m.common.untitled}
                  </h2>
                </div>
              )}
            </li>
          ))}
        </ul>
        {social === null && <p className="mt-4 text-center text-sm text-muted-foreground" role="status">{t.loadError}</p>}
      </div>

      <div role="tabpanel" id={`${id}-comments`} aria-labelledby={`${id}-comments-tab`} hidden={tab !== 'comments'} className="pt-6">
        <Comments social={social} artworks={artworks} summary={summary} />
      </div>
    </div>
  )
}

function ArtworkTile({
  artwork,
  obra,
  alt,
  counts,
  large,
}: {
  artwork: ArtistProfileArtwork
  obra: ArtworkSummary
  alt: string
  /** undefined while loading, null if it couldn't. */
  counts: { likes: number; comments: number } | null | undefined
  /** The artist's only obra, shown across the whole column. */
  large: boolean
}) {
  const { locale, m } = useI18n()
  const t = m.artistProfile
  const title = artwork.title ?? m.common.untitled
  const countText = counts
    ? `${plural(locale, counts.likes, t.likes)}, ${plural(locale, counts.comments, t.comments)}`
    : ''

  const figures = counts && (
    <>
      <span className="inline-flex items-center gap-1">
        <Heart className="h-[1.1em] w-[1.1em] fill-current" aria-hidden />
        {formatNumber(locale, counts.likes)}
      </span>
      <span className="inline-flex items-center gap-1">
        <MessageCircle className="h-[1.1em] w-[1.1em] fill-current" aria-hidden />
        {formatNumber(locale, counts.comments)}
      </span>
    </>
  )

  return (
    <ObraLink
      obra={obra}
      className={`group relative block aspect-square overflow-hidden ${large ? 'rounded-2xl' : 'rounded-md'} bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-collage-blue/40`}
    >
      <img
        src={imageSrc(artwork.imageUrl, large ? 828 : 640)}
        srcSet={imageSrcSet(artwork.imageUrl, large ? 1200 : 640)}
        sizes={large ? '(min-width: 640px) 576px, calc(100vw - 32px)' : '(min-width: 1024px) 300px, calc((100vw - 40px) / 3)'}
        loading="lazy"
        decoding="async"
        alt={alt}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
      />
      <span className="sr-only">{title}{countText && `. ${countText}`}</span>
      {figures && (
        <>
          {/* Phones and tablets: always in view, small, at the bottom. */}
          <span
            aria-hidden
            className={`absolute inset-x-0 bottom-0 flex gap-3 bg-gradient-to-t from-ink/75 to-transparent px-2 font-bold text-white pointer-fine:hidden ${large ? 'gap-4 px-4 pt-10 pb-3 text-base' : 'pt-6 pb-1.5 text-xs'}`}
          >
            {figures}
          </span>
          {/* With a mouse: centred over the obra on hover, as on Instagram. */}
          <span
            aria-hidden
            className={`absolute inset-0 hidden items-center justify-center gap-6 bg-ink/45 ${large ? 'text-2xl' : 'text-lg'} font-bold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none pointer-fine:flex`}
          >
            {figures}
          </span>
        </>
      )}
    </ObraLink>
  )
}

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
      <ul className="space-y-5" aria-busy>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex gap-3">
            <span className="h-12 w-12 shrink-0 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
            <span className="h-12 flex-1 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          </li>
        ))}
      </ul>
    )
  }
  if (social === null) return <p className="text-center text-muted-foreground" role="status">{t.loadError}</p>

  const bySlug = new Map(artworks.map((artwork) => [artwork.slug, artwork]))
  const comments = social.comments.filter((comment) => bySlug.has(comment.artworkSlug))

  if (comments.length === 0) {
    return (
      <div className="py-8 text-center">
        <MessageCircle className="mx-auto h-10 w-10 text-ink/30" aria-hidden />
        <p className="mt-3 text-lg text-muted-foreground">{t.noComments}</p>
        <Link
          href={galleryArtworkPath(artworks[0].slug)}
          prefetch={false}
          className="mt-5 inline-flex min-h-12 items-center rounded-full border-2 border-ink/15 bg-card px-5 py-2 text-base font-semibold text-ink hover:border-ink/30"
        >
          {t.commentInGallery}
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y-2 divide-ink/5">
      {comments.map((comment) => {
        const artwork = bySlug.get(comment.artworkSlug)!
        const title = artwork.title ?? m.common.untitled
        return (
          <li key={comment.id} className="flex gap-3 py-4 first:pt-0">
            <ObraLink obra={summary(artwork)} className="shrink-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-collage-blue/40 rounded-md">
              <img
                src={imageSrc(artwork.imageUrl, 128)}
                alt={title}
                loading="lazy"
                decoding="async"
                className="h-12 w-12 rounded-md object-cover"
              />
            </ObraLink>
            <div className="min-w-0">
              <p className="break-words text-base text-ink">
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
