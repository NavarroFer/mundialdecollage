'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import Link from 'next/link'
import { Globe, Instagram } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { fmt, plural } from '@/lib/i18n/format'
import { loadArtistCard, type ArtistCard } from '@/lib/artist-card'
import { artistProfileSlug } from '@/lib/artist-slug'
import { createHoverIntent, isRealMouse } from '@/lib/hover-intent'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'

// The author of an obra in the feed: the name goes to their profile, and on a
// desktop with a mouse, resting on it opens a card with what the profile
// shows. On touch the tap just follows the link. The card is asked for once
// per artist (lib/artist-card.ts) and comes from the CDN. Keyboard focus opens
// it too, Escape closes it, and it never takes the focus.

type Props = {
  profileId: string
  name: string
  avatar: ReactNode
  /** What goes under the name (country, time). Not part of the link. */
  meta: ReactNode
}

type Loaded = { state: 'loading' } | { state: 'ready'; card: ArtistCard }

export function ArtistHoverCard({ profileId, name, avatar, meta }: Props) {
  const { locale, m } = useI18n()
  const t = m.community
  const cardId = useId()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const closeCard = useCallback(() => setOpen(false), [])

  const intent = useMemo(() => createHoverIntent({
    onOpen: () => {
      setOpen(true)
      setLoaded((current) => current ?? { state: 'loading' })
      loadArtistCard(profileId)
        // A profile that is not public, or a failed request, simply has no card.
        .then((card) => {
          if (card) setLoaded({ state: 'ready', card })
          else { setLoaded(null); closeCard() }
        })
        .catch(() => { setLoaded(null); closeCard() })
    },
    onClose: closeCard,
  }), [profileId, closeCard])
  useEffect(() => () => intent.dispose(), [intent])

  // Escape closes the card even when the pointer, not the focus, is on it.
  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') intent.escape() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, intent])

  function onPointerEnter(event: PointerEvent) {
    if (isRealMouse(event.pointerType, window.matchMedia.bind(window))) intent.enter()
  }
  function onFocus(event: FocusEvent) {
    // Only keyboard focus: a tap also focuses the link, and must just navigate.
    let visible = false
    try { visible = (event.target as HTMLElement).matches(':focus-visible') } catch { /* no support: stay closed */ }
    if (visible) intent.focus()
  }
  function onBlur(event: FocusEvent) {
    if (!wrapper.current?.contains(event.relatedTarget as Node | null)) intent.leave()
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') intent.escape()
  }

  const card = open && loaded?.state === 'ready' ? loaded.card : null
  const showing = open && Boolean(loaded)

  return (
    <div
      ref={wrapper}
      className="relative flex min-w-0 flex-1 items-center gap-3"
      onPointerEnter={onPointerEnter}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') intent.leave() }}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        {/* The link stretches over the avatar and the line under the name, so the whole header goes to the profile. */}
        <Link
          href={`/artistas/${artistProfileSlug(name, profileId)}`}
          aria-expanded={showing}
          aria-controls={showing ? cardId : undefined}
          className="block truncate font-semibold text-ink before:absolute before:inset-0 before:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue"
        >
          {name}
        </Link>
        {meta}
      </div>

      {showing && (
        <div id={cardId} role="dialog" aria-label={fmt(t.profileCard, { name })} className="absolute top-full left-0 z-30 w-80 max-w-[calc(100vw-2rem)] pt-2">
          <div className="rounded-2xl border-2 border-ink/10 bg-card p-4 shadow-xl">
            {card ? <CardBody card={card} name={name} profileId={profileId} /> : <CardSkeleton />}
          </div>
        </div>
      )}
    </div>
  )
}

function CardBody({ card, name, profileId }: { card: ArtistCard; name: string; profileId: string }) {
  const { locale, m } = useI18n()
  const t = m.community
  const links = [
    card.instagram ? { href: `https://instagram.com/${card.instagram}`, label: `@${card.instagram}`, icon: <Instagram aria-hidden className="size-4 text-collage-red" /> } : null,
    card.website ? { href: card.website, label: m.common.website, icon: <Globe aria-hidden className="size-4 text-collage-blue" /> } : null,
  ].filter((link): link is NonNullable<typeof link> => link !== null)
  return (
    <>
      <p className="font-display text-xl leading-tight tracking-tight text-ink uppercase">{name}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <span aria-hidden="true">{countryCodeToFlag(card.countryCode)}</span>
        {countryCodeToName(card.countryCode, locale)}
        <span aria-hidden="true">·</span>
        {card.artworks} {plural(locale, card.artworks, m.artistProfile.statArtworks)}
      </p>
      {card.techniques.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {card.techniques.map((technique) => (
            <li key={technique} className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink">{technique}</li>
          ))}
        </ul>
      )}
      {card.images.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-1.5">
          {card.images.map((image, index) => (
            <li key={`${image}-${index}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" loading="lazy" decoding="async" className="aspect-square w-full rounded-lg object-cover" />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {links.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-collage-blue">
            {link.icon}
            {link.label}
            <span className="sr-only"> {m.common.opensInNewTab}</span>
          </a>
        ))}
        <Link href={`/artistas/${artistProfileSlug(name, profileId)}`} className="ml-auto inline-flex min-h-9 items-center rounded-full bg-ink px-4 text-sm font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
          {t.viewProfile}
        </Link>
      </div>
    </>
  )
}

function CardSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <div className="h-6 w-2/3 rounded bg-ink/10 motion-safe:animate-pulse" />
      <div className="h-4 w-1/2 rounded bg-ink/10 motion-safe:animate-pulse" />
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((item) => <div key={item} className="aspect-square rounded-lg bg-ink/10 motion-safe:animate-pulse" />)}
      </div>
    </div>
  )
}
