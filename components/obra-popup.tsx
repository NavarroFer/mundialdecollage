'use client'

/* Artwork URLs come from Supabase Storage, as on /obras/[slug]. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { ArrowLeft, ArrowRight, Globe, Instagram, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArtworkImage } from '@/components/artwork-image'
import { ShareArtwork } from '@/components/share-artwork'
import { StorePromo } from '@/components/store-promo'
import { SurpriseArtwork } from '@/components/surprise-artwork'
import { TrackView, TrackedLink } from '@/components/track'
import { ObraLink } from '@/components/obra-modal'
import type { ArtworkSummary } from '@/lib/finalists'
import type { ObraDetail } from '@/lib/obra-detail'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { imageSrc } from '@/lib/image-src'
import { track } from '@/lib/track'

// One request per obra and visit, answered by the CDN; a failed one is
// forgotten so opening the obra again tries again.
const details = new Map<string, Promise<ObraDetail>>()

function loadDetail(slug: string): Promise<ObraDetail> {
  let pending = details.get(slug)
  if (!pending) {
    pending = fetch(`/api/obras/${encodeURIComponent(slug)}`).then((response) => {
      if (!response.ok) throw new Error(String(response.status))
      return response.json() as Promise<ObraDetail>
    })
    pending.catch(() => details.delete(slug))
    details.set(slug, pending)
  }
  return pending
}

// Big, labelled targets: many visitors are well past 50 and on a phone.
// Links out of the popup don't prefetch: each prefetch is a request through
// proxy.ts for a page most visitors won't open.
const pill =
  'inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-ink/15 bg-card px-5 py-2 text-base font-semibold text-ink hover:border-ink/30'
const closeButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-ink bg-paper px-5 text-base font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue motion-reduce:transition-none'

// What /obras/[slug] shows, in a popup over the list the obra was clicked in
// (components/obra-modal.tsx). The card's own data (photo, title, artist,
// country) shows at once; the rest arrives from app/api/obras/[slug].
export function ObraPopup({
  obra,
  onClose,
  returnFocus,
}: {
  obra: ArtworkSummary
  onClose: () => void
  returnFocus: RefObject<HTMLElement | null>
}) {
  const { locale, m } = useI18n()
  // undefined while it loads, null if it couldn't.
  const [loaded, setLoaded] = useState<{ slug: string; detail: ObraDetail | null } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const shownSlug = useRef(obra.slug)
  const relatedId = useId()
  const discoverId = useId()

  useEffect(() => {
    let current = true
    loadDetail(obra.slug).then(
      (detail) => { if (current) setLoaded({ slug: obra.slug, detail }) },
      () => { if (current) setLoaded({ slug: obra.slug, detail: null }) },
    )
    // Another obra chosen inside the popup starts from its top.
    if (shownSlug.current !== obra.slug) {
      shownSlug.current = obra.slug
      contentRef.current?.scrollTo({ top: 0 })
      contentRef.current?.focus({ preventScroll: true })
    }
    return () => { current = false }
  }, [obra.slug])

  const detail = loaded?.slug === obra.slug ? loaded.detail : undefined
  const full = detail?.obra
  const title = obra.artworkTitle ?? m.common.untitled
  const neighbors = detail ? [detail.previous, detail.next].filter((artwork) => artwork !== null) : []

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        ref={contentRef}
        showClose={false}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus.current?.focus({ preventScroll: true })
        }}
        // Whole screen on a phone; a centered window from tablets up.
        className="inset-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto overscroll-contain rounded-none border-0 bg-background sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[92dvh] sm:w-[calc(100%-3rem)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border-2"
      >
        <TrackView key={obra.slug} event="artwork_page_view" />

        <div className="sticky top-0 z-10 flex justify-end border-b-2 border-ink/10 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <DialogClose className={closeButton}>
            <X className="size-5" aria-hidden="true" />
            {m.artwork.close}
          </DialogClose>
        </div>

        <div className="px-5 pt-6 pb-10 sm:px-8">
          <div className="overflow-hidden rounded-2xl border-2 border-ink/10 bg-muted">
            <ArtworkImage
              key={obra.slug}
              src={imageSrc(obra.imageUrl, 1200)}
              alt={fmt(m.common.artworkBy, { title, name: obra.name })}
              // The whole obra in view, whatever its format, with its title
              // and artist still on screen below it.
              className="max-h-[58dvh] object-contain"
            />
          </div>

          <div className="mt-8">
            {full?.technique && (
              <p className="text-sm font-bold tracking-[0.25em] text-collage-red uppercase">
                {m.common.techniques[full.technique] ?? full.technique}
              </p>
            )}
            <DialogTitle className="font-display mt-2 text-3xl tracking-tight uppercase sm:text-5xl">{title}</DialogTitle>

            <p className="mt-5 flex items-center gap-2 text-lg font-semibold text-ink">
              <span aria-hidden>{countryCodeToFlag(obra.countryCode)}</span>
              {detail ? (
                <TrackedLink
                  href={detail.artistHref}
                  prefetch={false}
                  event="artwork_artist_profile_click"
                  className="underline decoration-2 underline-offset-4 hover:text-collage-blue"
                >
                  {obra.name}
                </TrackedLink>
              ) : obra.name}
            </p>
            <p className="text-base text-muted-foreground">{countryCodeToName(obra.countryCode, locale)}</p>

            {full && (full.instagram || full.website) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {full.instagram && (
                  <a href={full.instagram} target="_blank" rel="noopener noreferrer" className={pill}>
                    <Instagram className="size-5 text-collage-red" aria-hidden="true" />
                    Instagram
                  </a>
                )}
                {full.website && (
                  <a href={full.website} target="_blank" rel="noopener noreferrer" className={pill}>
                    <Globe className="size-5 text-collage-blue" aria-hidden="true" />
                    {m.common.website}
                  </a>
                )}
              </div>
            )}

            {/* The popup opens from public listings only, so its link works for everyone. */}
            <div className="mt-10">
              <ShareArtwork slug={obra.slug} title={title} name={obra.name} isPublic isOwn={false} />
            </div>
          </div>

          {detail === undefined && (
            <div role="status" className="mt-14 border-t-2 border-ink/10 pt-10">
              <span className="sr-only">{m.artwork.loading}</span>
              <Skeleton className="h-8 w-2/3" />
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="hidden aspect-square w-full sm:block" />
                <Skeleton className="hidden aspect-square w-full sm:block" />
              </div>
            </div>
          )}

          {detail === null && (
            <div role="alert" className="mt-14 rounded-2xl border-2 border-ink/10 bg-paper p-5">
              <p className="text-base text-ink">{m.artwork.loadError}</p>
              <a
                href={`/obras/${obra.slug}`}
                className="mt-3 inline-flex min-h-12 items-center gap-2 text-base font-semibold text-collage-blue underline underline-offset-4"
              >
                {m.artwork.openPage}
                <ArrowRight className="size-5" aria-hidden="true" />
              </a>
            </div>
          )}

          {detail && detail.related.length > 0 && (
            <section className="mt-14 border-t-2 border-ink/10 pt-10" aria-labelledby={relatedId}>
              <h2 id={relatedId} className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">
                {m.collage.label} — {obra.name}
              </h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                {detail.related.map((artwork) => {
                  const artworkTitle = artwork.artworkTitle ?? m.common.untitled
                  return (
                    <ObraLink key={artwork.slug} obra={artwork} className="group overflow-hidden rounded-2xl border-2 border-ink/10 bg-card">
                      <img
                        src={imageSrc(artwork.imageUrl, 640)}
                        alt={fmt(m.common.artworkBy, { title: artworkTitle, name: artwork.name })}
                        className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                      <p className="p-4 text-base font-semibold text-ink group-hover:text-collage-blue">{artworkTitle}</p>
                    </ObraLink>
                  )
                })}
              </div>
              <TrackedLink
                href={detail.artistHref}
                prefetch={false}
                event="artwork_artist_profile_click"
                className="mt-5 inline-flex min-h-12 items-center text-base font-semibold text-collage-blue underline underline-offset-4"
              >
                {obra.name}
                <ArrowRight className="ml-2 size-5" aria-hidden="true" />
              </TrackedLink>
            </section>
          )}

          {neighbors.length > 0 && (
            <section className="mt-10 border-t-2 border-ink/10 pt-8" aria-labelledby={discoverId}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 id={discoverId} className="font-display text-2xl tracking-tight text-ink uppercase">
                  {m.artwork.discoverMore}
                </h2>
                <SurpriseArtwork label={m.artwork.surprise} exclude={obra.slug} />
              </div>
              <nav className="mt-5 grid gap-4 sm:grid-cols-2" aria-label={m.artwork.discoverMore}>
                {neighbors.map((artwork) => (
                  <ObraLink
                    key={artwork.slug}
                    obra={artwork}
                    onClick={() => track('artwork_next_click')}
                    className="group flex min-h-28 items-center gap-4 overflow-hidden rounded-2xl border-2 border-ink/10 bg-card text-ink hover:border-collage-blue"
                  >
                    <img
                      src={imageSrc(artwork.imageUrl, 320)}
                      alt=""
                      loading="lazy"
                      width={112}
                      height={112}
                      className="size-28 shrink-0 object-cover"
                    />
                    <span className="min-w-0 flex-1 py-3">
                      <span className="line-clamp-2 text-base font-semibold group-hover:text-collage-blue">{artwork.artworkTitle ?? m.common.untitled}</span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">{artwork.name}</span>
                    </span>
                    <ArrowRight className="mr-4 size-5 shrink-0 text-collage-blue" aria-hidden="true" />
                  </ObraLink>
                ))}
              </nav>
            </section>
          )}

          {/* Inviting to participate only while the call is open. */}
          {detail?.callOpen && (
            <section className="mt-14 rounded-3xl border-2 border-ink/10 bg-paper p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-10">
              <div>
                <h2 className="font-display text-2xl tracking-tight text-ink uppercase sm:text-3xl">{m.artistInvite.title}</h2>
                <p className="mt-2 max-w-xl text-base text-muted-foreground">{m.artistInvite.body}</p>
              </div>
              <Button asChild size="lg" variant="primary" className="mt-6 h-auto min-h-14 whitespace-normal py-3 sm:mt-0">
                <TrackedLink href="/onboarding" prefetch={false} event="artwork_participate_click">
                  {m.artistInvite.cta}
                </TrackedLink>
              </Button>
            </section>
          )}

          {detail && <StorePromo m={m} event="store_click_artwork" className="mt-6" />}

          <DialogClose className={`${closeButton} mt-10 min-h-14 w-full text-lg`}>
            <ArrowLeft className="size-5" aria-hidden="true" />
            {m.artwork.back}
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
