'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Info, MessageCircle, X } from 'lucide-react'
import { track } from '@/lib/track'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ArtworkLike } from './ArtworkLike'
import { ArtworkStamp } from './ArtworkStamp'
import { ArtworkComments } from './ArtworkComments'
import { ArtworkShare } from './ArtworkShare'
import { ArtistInvite } from './ArtistInvite'
import { ArtworkViewers } from './PresenceCounter'
import { loadArtworkSocial, peekArtworkSocial, type SocialResult } from './artworkSocial'
import type { Artwork } from '@/data/artworks'
import { useInteractionStore } from '../interaction/store'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'

// How long the player has to keep looking at an obra before its likes and
// comments are fetched: skips the ones they only sweep past.
const PREFETCH_DWELL_MS = 250

/**
 * An obra up close. It opens in contemplation: the camera glides in front of
 * it and only its name stays on screen, over the walk, so the image is what
 * the visitor sees, with how many comments it has beside the name. The
 * details (story, likes, comments, stamp) unfold on request, and are already
 * open when coming back from signing in to use them.
 */
export function ArtworkModal({ artworks, theme }: { artworks: Artwork[]; theme: GalleryTheme }) {
  const openId = useInteractionStore((state) => state.openId)
  const detailsOpen = useInteractionStore((state) => state.detailsOpen)
  const artwork = artworks.find((item) => item.id === openId)
  const { m } = useI18n()
  const t = m.gallery.contemplation
  const themeClass = cn(styles.modal, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden)
  // Opened from the comments button, the ficha scrolls down to them.
  const [commentsFor, setCommentsFor] = useState<string | null>(null)

  useEffect(() => {
    if (openId) track('artwork_open')
  }, [openId])

  // Fetch while the visitor walks up to the obra, so E opens it complete.
  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = useInteractionStore.subscribe((state, previous) => {
      if (state.targetId === previous.targetId) return
      window.clearTimeout(timer)
      const id = state.targetId
      if (id) timer = window.setTimeout(() => void loadArtworkSocial(id), PREFETCH_DWELL_MS)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  if (!artwork) return null

  const close = () => useInteractionStore.getState().close()
  const openDetails = (atComments: boolean) => {
    setCommentsFor(atComments ? artwork.id : null)
    useInteractionStore.getState().setDetails(true)
  }

  if (!detailsOpen) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) close() }}>
        <DialogContent
          aria-describedby={undefined}
          showClose={false}
          overlayClassName="bg-transparent"
          className={cn(themeClass, styles.contemplation, 'top-auto bottom-4 flex w-[min(40rem,calc(100%-2rem))] translate-y-0 flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap')}
        >
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display truncate text-xl leading-tight text-ink">{artwork.title}</DialogTitle>
            <p className="truncate text-sm font-semibold text-muted-foreground">{artwork.artist} · {artwork.year}</p>
          </div>
          {/* On a phone the two buttons get a row of their own under the name. */}
          <div className="order-2 flex w-full gap-2 sm:order-none sm:w-auto">
            <ContemplationComments key={artwork.id} slug={artwork.id} onOpen={() => openDetails(true)} />
            <button type="button" className={cn(styles.contemplationButton, 'flex-1 justify-center sm:flex-none')} onClick={() => openDetails(false)}>
              <Info className="h-4 w-4" aria-hidden="true" /> {t.details}
            </button>
          </div>
          <button type="button" className={cn(styles.contemplationClose, 'order-1 sm:order-none')} onClick={close} aria-label={t.back} title={t.keys}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="bg-ink/25 backdrop-blur-[1px]"
        className={cn(themeClass, 'flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-5 overflow-y-auto p-5 sm:left-auto sm:right-6 sm:w-[min(28rem,calc(100%-3rem))] sm:max-w-md sm:translate-x-0 sm:p-7')}
      >
        <button type="button" className="-mb-3 inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold underline" onClick={() => useInteractionStore.getState().setDetails(false)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t.hideDetails}
        </button>
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-card sm:hidden">
          <Image
            src={artwork.image}
            alt={artwork.title}
            fill
            sizes="(min-width: 640px) 40vw, 90vw"
            className="object-contain"
          />
        </div>
        <header className="flex min-w-0 shrink-0 flex-col gap-2">
          <DialogTitle className="font-display text-3xl leading-tight text-ink">{artwork.title}</DialogTitle>
          <p className="text-base font-semibold">{artwork.artist} · {artwork.year}</p>
          <p className="text-sm leading-relaxed opacity-80">{artwork.description}</p>
          <ArtworkViewers artworkId={artwork.id} />
        </header>
        <ArtworkSocialPanel key={artwork.id} artwork={artwork} showComments={commentsFor === artwork.id} />
        <footer className="flex shrink-0 flex-col gap-2 border-t border-ink/10 pt-4">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-70">{m.gallery.closeToContinue}</p>
          <Link href="/" onClick={() => track('home_from_gallery')} className="self-start text-sm font-semibold underline">{m.gallery.homeLink}</Link>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

const pulse = 'animate-pulse rounded-full bg-ink/10 motion-reduce:animate-none'

// The obra's likes and comments: the prefetched ones when they're already
// here (the usual case), else fetched now. `retry` asks again after a failure.
function useArtworkSocial(slug: string) {
  const [result, setResult] = useState<SocialResult | undefined>(() => peekArtworkSocial(slug))
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadArtworkSocial(slug).then((next) => { if (active) setResult(next) })
    return () => { active = false }
  }, [slug, attempt])
  const retry = useCallback(() => {
    setResult(undefined)
    setAttempt((value) => value + 1)
  }, [])
  return { result, retry }
}

// Beside the obra's name in contemplation: how many comments it has, one
// tap from reading them.
function ContemplationComments({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const { result } = useArtworkSocial(slug)
  const { locale, m } = useI18n()
  const t = m.gallery.comments
  const count = result && !('error' in result) ? result.comments.comments.length : null
  return (
    <button type="button" className={cn(styles.contemplationComments, 'flex-1 sm:flex-none')} onClick={onOpen} title={m.gallery.contemplation.comments}>
      <MessageCircle aria-hidden="true" />
      {count === null ? t.title : count === 0 ? t.action : plural(locale, count, t.count)}
    </button>
  )
}

// Where the invitation to send an obra appears: under the like or the comment
// that triggered it. It doesn't go away on its own: closing the obra (a tap
// outside, E) used to take it with it before anyone could read it, so once
// shown it comes back under the like of every obra opened afterwards, until
// «Ahora no» or «Mandá tu obra» settle it for the rest of the visit.
type Invite = 'like' | 'comment' | 'dismissed' | null
let inviteForVisit: 'unseen' | 'pending' | 'settled' = 'unseen'

// Likes and comments share one request and appear in the same frame, over
// placeholders the size of what replaces them so nothing below jumps.
function ArtworkSocialPanel({ artwork, showComments }: { artwork: Artwork; showComments: boolean }) {
  const { result, retry } = useArtworkSocial(artwork.id)
  // Already fetched (the usual case): it opens with the modal, no fade of its own.
  const [instant] = useState(() => result !== undefined)
  // Comments sent from this ficha, on top of the fetched count.
  const [sentHere, setSentHere] = useState(0)
  const commentField = useRef<HTMLTextAreaElement>(null)
  const [invite, setInvite] = useState<Invite>(() => (inviteForVisit === 'settled' ? 'dismissed' : inviteForVisit === 'pending' ? 'like' : null))
  const { locale, m } = useI18n()
  const showInvite = useCallback((from: 'like' | 'comment') => setInvite((current) => {
    if (current) return current
    inviteForVisit = 'pending'
    return from
  }), [])
  // Stable, so ArtworkLike/ArtworkComments can keep them in their callbacks' deps.
  const afterLike = useCallback(() => showInvite('like'), [showInvite])
  const afterComment = useCallback(() => {
    setSentHere((count) => count + 1)
    showInvite('comment')
  }, [showInvite])
  const settleInvite = useCallback(() => {
    inviteForVisit = 'settled'
    setInvite('dismissed')
  }, [])

  const social = result && !('error' in result) ? result : undefined
  const failed = result !== undefined && !social
  const reveal = cn(!instant && 'animate-in fade-in duration-300 motion-reduce:animate-none')
  const inviteUnder = (from: Invite) => social?.canJoin && invite === from && <ArtistInvite onDismiss={settleInvite} onAccept={settleInvite} />
  const writeComment = () => {
    const field = commentField.current
    if (!field) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    field.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
    field.focus({ preventScroll: true })
  }

  return (
    <>
      <div className={cn(styles.ficheActions, 'shrink-0')}>
        {social ? (
          <ArtworkLike slug={artwork.id} initial={social.like} onSaved={afterLike} className={reveal} />
        ) : failed ? (
          <p role="alert" className={cn(styles.ficheNote, 'text-sm text-red-700')}>
            {m.gallery.like.unavailable}{' '}
            <button type="button" className="underline" onClick={retry}>
              {m.gallery.like.retry}
            </button>
          </p>
        ) : (
          <div aria-hidden="true" className={cn(styles.ficheSkeleton, 'animate-pulse motion-reduce:animate-none')} />
        )}
        {social ? (
          <button type="button" onClick={writeComment} className={cn(styles.ficheAction, reveal)}>
            <MessageCircle aria-hidden="true" />
            <span className={styles.ficheActionText}>
              <span className={styles.ficheActionLabel}>{m.gallery.comments.action}</span>
              <span className={styles.ficheActionMeta}>{plural(locale, social.comments.comments.length + sentHere, m.gallery.comments.count)}</span>
            </span>
          </button>
        ) : !failed && (
          <div aria-hidden="true" className={cn(styles.ficheSkeleton, 'animate-pulse motion-reduce:animate-none')} />
        )}
        <ArtworkStamp slug={artwork.id} signedIn={social?.like.signedIn ?? false} />
        <ArtworkShare slug={artwork.id} title={artwork.title} artist={artwork.artist} />
      </div>
      {inviteUnder('like')}
      {social ? (
        <div className={cn('shrink-0', reveal)}>
          <ArtworkComments slug={artwork.id} initial={social.comments} onSent={afterComment} fieldRef={commentField} scrollIntoView={showComments} />
        </div>
      ) : !failed && (
        <div aria-hidden="true" className="shrink-0 space-y-3 border-t border-ink/10 pt-5">
          <div className={cn(pulse, 'h-4 w-28')} />
          <div className={cn(pulse, 'h-20 w-full rounded-lg')} />
        </div>
      )}
      {inviteUnder('comment')}
    </>
  )
}
