'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { track } from '@/lib/track'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ArtworkLike } from './ArtworkLike'
import { ArtworkComments } from './ArtworkComments'
import { ArtworkShare } from './ArtworkShare'
import { ArtistInvite } from './ArtistInvite'
import { ArtworkViewers } from './PresenceCounter'
import { LiveReactions } from './LiveReactions'
import { loadArtworkSocial, peekArtworkSocial, type SocialResult } from './artworkSocial'
import type { Artwork } from '@/data/artworks'
import { useInteractionStore } from '../interaction/store'
import type { GalleryTheme } from '../themes'
import styles from '../gallery-theme.module.css'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/client'

// How long the player has to keep looking at an obra before its likes and
// comments are fetched: skips the ones they only sweep past.
const PREFETCH_DWELL_MS = 250

export function ArtworkModal({ artworks, theme }: { artworks: Artwork[]; theme: GalleryTheme }) {
  const openId = useInteractionStore((state) => state.openId)
  const artwork = artworks.find((item) => item.id === openId)
  const { m } = useI18n()

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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) useInteractionStore.getState().close() }}>
      <DialogContent
        aria-describedby={undefined}
        overlayClassName="bg-ink/25 backdrop-blur-[1px]"
        className={cn(styles.modal, theme === 'windows98' && styles.windows98, theme === 'collage' && styles.collage, theme === 'garden' && styles.garden, 'flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-6 overflow-y-auto p-6 sm:left-auto sm:right-6 sm:w-[min(25rem,calc(100%-3rem))] sm:max-w-md sm:translate-x-0 sm:p-8')}
      >
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-card sm:hidden">
          <Image
            src={artwork.image}
            alt={artwork.title}
            fill
            sizes="(min-width: 640px) 40vw, 90vw"
            className="object-contain"
          />
        </div>
        <div className="flex min-w-0 shrink-0 flex-col justify-center gap-3">
          <DialogTitle className="font-display text-2xl leading-tight text-ink">{artwork.title}</DialogTitle>
          <p className="text-sm font-semibold tracking-wide text-muted-foreground">
            {artwork.artist} · {artwork.year}
          </p>
          <p className="text-base leading-relaxed text-ink/80">{artwork.description}</p>
          <ArtworkViewers artworkId={artwork.id} />
          <LiveReactions artworkId={artwork.id} />
          <ArtworkSocialPanel key={artwork.id} artwork={artwork} />
          <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {m.gallery.closeToContinue}
          </p>
          <Link href="/" onClick={() => track('home_from_gallery')} className="text-sm font-semibold underline">{m.gallery.homeLink}</Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const pulse = 'animate-pulse rounded-full bg-ink/10 motion-reduce:animate-none'

// Where the invitation to send an obra appears: under the like or the comment
// that triggered it. Once shown or dismissed it stays that way while this
// obra is open, and "Ahora no" silences it for the rest of the visit.
type Invite = 'like' | 'comment' | 'dismissed' | null
let inviteDismissed = false

// Likes and comments share one request and appear in the same frame, over
// placeholders the size of what replaces them so nothing below jumps.
function ArtworkSocialPanel({ artwork }: { artwork: Artwork }) {
  const [result, setResult] = useState<SocialResult | undefined>(() => peekArtworkSocial(artwork.id))
  // Already fetched (the usual case): it opens with the modal, no fade of its own.
  const [instant] = useState(() => result !== undefined)
  const [attempt, setAttempt] = useState(0)
  const [invite, setInvite] = useState<Invite>(() => (inviteDismissed ? 'dismissed' : null))
  const { m } = useI18n()
  // Stable, so ArtworkLike/ArtworkComments can keep them in their callbacks' deps.
  const afterLike = useCallback(() => setInvite((current) => current ?? 'like'), [])
  const afterComment = useCallback(() => setInvite((current) => current ?? 'comment'), [])
  const dismissInvite = useCallback(() => {
    inviteDismissed = true
    setInvite('dismissed')
  }, [])

  useEffect(() => {
    let active = true
    loadArtworkSocial(artwork.id).then((next) => { if (active) setResult(next) })
    return () => { active = false }
  }, [artwork.id, attempt])

  const social = result && !('error' in result) ? result : undefined
  const failed = result !== undefined && !social
  const reveal = cn(!instant && 'animate-in fade-in duration-300 motion-reduce:animate-none')
  const inviteUnder = (from: Invite) => social?.canJoin && invite === from && <ArtistInvite onDismiss={dismissInvite} />

  return (
    <>
      {social ? (
        <div className={reveal}><ArtworkLike slug={artwork.id} initial={social.like} onSaved={afterLike} /></div>
      ) : failed ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {m.gallery.like.unavailable}{' '}
          <button type="button" className="underline" onClick={() => { setResult(undefined); setAttempt((value) => value + 1) }}>
            {m.gallery.like.retry}
          </button>
        </p>
      ) : (
        <div aria-hidden="true" className={cn(pulse, 'mt-3 h-12 w-36')} />
      )}
      {inviteUnder('like')}
      <ArtworkShare slug={artwork.id} title={artwork.title} artist={artwork.artist} />
      {social ? (
        <div className={reveal}><ArtworkComments slug={artwork.id} initial={social.comments} onSent={afterComment} /></div>
      ) : !failed && (
        <div aria-hidden="true" className="mt-2 space-y-3 border-t border-ink/10 pt-4">
          <div className={cn(pulse, 'h-4 w-28')} />
          <div className={cn(pulse, 'h-20 w-full rounded-lg')} />
        </div>
      )}
      {inviteUnder('comment')}
    </>
  )
}
