'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { getArtworkLike, likeArtwork } from '@/app/[locale]/(site)/galeria-3d/actions'
import { GoogleIcon, startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { galleryReturnPath } from '@/lib/gallery-return'
import { track } from '@/lib/track'
import { useInteractionStore } from '../interaction/store'
import { forgetArtworkSocial } from './artworkSocial'
import styles from '../gallery-theme.module.css'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'
import { cn } from '@/lib/utils'

type LikeState = { count: number; liked: boolean; signedIn: boolean }

// The like's «Pulse Heart», after React Bits (reactbits.dev/micro/pulse-heart):
// the heart contracts to a dot, turns red at its smallest and springs back
// past its size, the tile giving a little with it, while the count rolls over.
const PULSE_MS = 560
/** Share of the pulse spent contracting; the heart turns red there. */
const PULSE_SWAP = 0.4
/** How small the heart gets. */
const PULSE_DOT = 0.3
const PULSE_OVERSHOOT = 1.7
/** How much the whole tile shrinks with it. */
const PULSE_SQUEEZE = 0.03

/** 0 → 1 while contracting (ease-out), then back to 0 past it (a «back» ease that overshoots). */
function pulseAt(t: number) {
  if (t < PULSE_SWAP) return 1 - (1 - t / PULSE_SWAP) ** 3
  const u = (t - PULSE_SWAP) / (1 - PULSE_SWAP) - 1
  return -((PULSE_OVERSHOOT + 1) * u ** 3 + PULSE_OVERSHOOT * u ** 2)
}

// Drives the pulse frame by frame on the elements themselves: no re-render
// per frame. `start` calls `swap` at the heart's smallest point (right away
// when motion is reduced); `stop` puts everything back.
function usePulse() {
  const tileRef = useRef<HTMLButtonElement>(null)
  const heartRef = useRef<SVGSVGElement>(null)
  const frame = useRef(0)

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    if (heartRef.current) heartRef.current.style.transform = ''
    if (tileRef.current) {
      tileRef.current.style.transform = ''
      delete tileRef.current.dataset.running
    }
  }, [])

  const start = useCallback((swap: () => void) => {
    const button = tileRef.current
    const icon = heartRef.current
    if (!button || !icon || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return swap()
    stop()
    button.dataset.running = ''
    let swapped = false
    const began = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / PULSE_MS)
      const swell = pulseAt(t)
      icon.style.transform = `scale(${1 - (1 - PULSE_DOT) * swell})`
      button.style.transform = `scale(${1 - PULSE_SQUEEZE * swell})`
      if (!swapped && t >= PULSE_SWAP) {
        swapped = true
        swap()
      }
      if (t < 1) frame.current = requestAnimationFrame(tick)
      else stop()
    }
    frame.current = requestAnimationFrame(tick)
  }, [stop])

  useEffect(() => stop, [stop])
  return { tileRef, heartRef, start, stop }
}

// The old text slides up and out as the new one comes in from below.
function Rolling({ text }: { text: string }) {
  const [shown, setShown] = useState<{ text: string; from: string | null }>({ text, from: null })
  if (shown.text !== text) setShown({ text, from: shown.text })
  if (shown.from === null) return text
  return (
    <span className={styles.ficheRoll}>
      <span className={styles.ficheRollTrack} onAnimationEnd={() => setShown({ text, from: null })}>
        <span aria-hidden="true">{shown.from}</span>
        <span>{text}</span>
      </span>
    </span>
  )
}

// `initial` comes from the modal's single likes+comments fetch (artworkSocial.ts).
// `onSaved` lets the modal follow up once the like is in (ArtistInvite).
// A tile of the ficha's action grid: its notes span the row under it.
export function ArtworkLike({ slug, initial, onSaved, className }: { slug: string; initial: LikeState; onSaved?: () => void; className?: string }) {
  const [state, setState] = useState<LikeState>(initial)
  const [busy, setBusy] = useState(false)
  // A signed-out visitor pressed the heart: offer Google right under it.
  const [askSignIn, setAskSignIn] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')
  const { locale, m } = useI18n()
  const t = m.gallery.like
  // The server actions answer with an error code; show it in the reader's language.
  const errorText = { unavailable: t.unavailable, save_failed: t.saveFailed } as Record<string, string>
  const busyRef = useRef(false)
  const { tileRef, heartRef, start: startPulse, stop: stopPulse } = usePulse()

  // Likes need a Google account; the visitor comes back to this same obra
  // and the like finishes on its own (see the load effect below).
  const signIn = useCallback(async () => {
    track('sign_in_start')
    setRedirecting(true)
    await startGoogleSignIn(galleryReturnPath({ slug, intent: 'like' }))
  }, [slug])

  const save = useCallback(async (current: LikeState) => {
    if (busyRef.current || current.liked) return
    if (!current.signedIn) {
      setAskSignIn(true)
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    // The heart turns red at the pulse's smallest point, whether the server
    // has answered by then or not; a failure takes it back.
    const shown = new Promise<void>((resolve) => startPulse(() => {
      setState({ ...current, count: current.count + 1, liked: true })
      resolve()
    }))
    const undo = () => {
      stopPulse()
      setState(current)
    }
    try {
      const result = await likeArtwork(slug)
      if (result.error === 'sign_in_required') {
        undo()
        setAskSignIn(true)
        return
      }
      if (result.error) {
        undo()
        setError(errorText[result.error] ?? t.saveFailed)
        return
      }
      forgetArtworkSocial(slug)
      track('like_saved')
      onSaved?.()
      // Fetch the authoritative count: another tab may have already voted.
      const latest = await getArtworkLike(slug)
      await shown
      if (!('error' in latest)) setState(latest)
    } catch {
      undo()
      setError(t.saveFailed)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
    // errorText/t only change with the language, which reloads the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, onSaved, startPulse, stopPulse])

  // Back from Google with a like pending on this obra: save it.
  useEffect(() => {
    // Resuming an action from before the sign-in round trip, once per return.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (useInteractionStore.getState().consumeIntent(slug, 'like') && initial.signedIn && !initial.liked) void save(initial)
  }, [slug, initial, save])

  return (
    <>
      <button ref={tileRef} type="button" onClick={() => { track('like_click'); void save(state) }} disabled={busy || redirecting || state.liked}
        aria-pressed={state.liked} aria-expanded={!state.signedIn ? askSignIn : undefined}
        data-done={state.liked} className={cn(styles.ficheAction, styles.ficheActionInk, className)}>
        <Heart ref={heartRef} className={styles.ficheHeart} fill={state.liked ? 'currentColor' : 'none'} aria-hidden="true" />
        <span className={styles.ficheActionText}>
          <span className={styles.ficheActionLabel}>{state.liked ? t.liked : t.like}</span>
          <span className={styles.ficheActionMeta}><Rolling text={plural(locale, state.count, t.count)} /></span>
        </span>
      </button>
      {askSignIn && !state.liked && (
        <div className={cn(styles.ficheNote, 'space-y-2 rounded-[var(--gallery-radius)] border border-ink/15 p-4')}>
          <p className="text-sm font-semibold">{t.signIn}</p>
          <button type="button" onClick={() => void signIn()} disabled={redirecting} autoFocus
            className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60">
            <GoogleIcon />
            {redirecting ? m.auth.signingIn : m.auth.signIn}
          </button>
          <p className="text-xs text-muted-foreground">
            {t.signInNote} <a href="/politica-de-privacidad" target="_blank" rel="noreferrer" className="underline">{t.privacy}</a>
          </p>
        </div>
      )}
      {error && <p role="alert" className={cn(styles.ficheNote, 'text-sm text-red-700')}>{error}</p>}
      {state.signedIn && !state.liked && <p className={cn(styles.ficheFootnote, 'text-xs text-muted-foreground')}>{t.newsletter}</p>}
      {state.liked && <p role="status" className={cn(styles.ficheFootnote, 'text-sm text-muted-foreground')}>{t.thanks}</p>}
    </>
  )
}
