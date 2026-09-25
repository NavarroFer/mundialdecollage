'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { getArtworkLike, likeArtwork } from '@/app/galeria-3d/actions'
import { GoogleIcon, startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { galleryReturnPath } from '@/lib/gallery-return'
import { track } from '@/lib/track'
import { useInteractionStore } from '../interaction/store'
import { usePresenceStore } from '../presence/store'
import { forgetArtworkSocial } from './artworkSocial'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'

type LikeState = { count: number; liked: boolean; signedIn: boolean }

// `initial` comes from the modal's single likes+comments fetch (artworkSocial.ts).
export function ArtworkLike({ slug, initial }: { slug: string; initial: LikeState }) {
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
    try {
      const result = await likeArtwork(slug)
      if (result.error === 'sign_in_required') {
        setAskSignIn(true)
        return
      }
      if (result.error) {
        setError(errorText[result.error] ?? t.saveFailed)
        return
      }
      setState({ ...current, count: current.count + 1, liked: true })
      forgetArtworkSocial(slug)
      track('like_saved')
      // Everyone inside sees a heart rise from the obra.
      usePresenceStore.getState().react?.(slug, '❤️')
      // Fetch the authoritative count: another tab may have already voted.
      const latest = await getArtworkLike(slug)
      if (!('error' in latest)) setState(latest)
    } catch {
      setError(t.saveFailed)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
    // errorText/t only change with the language, which reloads the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // Back from Google with a like pending on this obra: save it.
  useEffect(() => {
    // Resuming an action from before the sign-in round trip, once per return.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (useInteractionStore.getState().consumeIntent(slug, 'like') && initial.signedIn && !initial.liked) void save(initial)
  }, [slug, initial, save])

  return (
    <div className="mt-3 space-y-3">
      <button type="button" onClick={() => { track('like_click'); void save(state) }} disabled={busy || redirecting || state.liked}
        aria-pressed={state.liked} aria-expanded={!state.signedIn ? askSignIn : undefined}
        className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-3 font-semibold disabled:opacity-60">
        <Heart className="h-5 w-5" fill={state.liked || askSignIn ? 'currentColor' : 'none'} aria-hidden="true" />
        {busy ? t.saving : state.liked ? t.liked : t.like}
        <span aria-label={plural(locale, state.count, t.count)}>· {state.count}</span>
      </button>
      {askSignIn && !state.liked && (
        <div className="space-y-2 rounded-xl border border-ink/15 p-4">
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
      {state.signedIn && !state.liked && <p className="text-xs text-muted-foreground">{t.newsletter}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {state.liked && <p role="status" className="text-sm text-muted-foreground">{t.thanks}</p>}
    </div>
  )
}
