'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { getArtworkLike, likeArtwork } from '@/app/galeria-3d/actions'
import { GoogleIcon, startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { galleryReturnPath } from '@/lib/gallery-return'
import { useInteractionStore } from '../interaction/store'
import { usePresenceStore } from '../presence/store'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'

type LikeState = { count: number; liked: boolean; signedIn: boolean }

export function ArtworkLike({ slug }: { slug: string }) {
  const [state, setState] = useState<LikeState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const { locale, m } = useI18n()
  const t = m.gallery.like
  // The server actions answer with an error code; show it in the reader's language.
  const errorText = { unavailable: t.unavailable, save_failed: t.saveFailed } as Record<string, string>
  const busyRef = useRef(false)

  // Likes need a Google account; the visitor comes back to this same obra
  // and the like finishes on its own (see the effect below).
  const signIn = useCallback(async () => {
    setBusy(true)
    await startGoogleSignIn(galleryReturnPath({ slug, intent: 'like' }))
  }, [slug])

  const save = useCallback(async (current: LikeState) => {
    if (busyRef.current || current.liked) return
    if (!current.signedIn) return signIn()
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const result = await likeArtwork(slug)
      if (result.error === 'sign_in_required') return signIn()
      if (result.error) {
        setError(errorText[result.error] ?? t.saveFailed)
        return
      }
      setState({ ...current, count: current.count + 1, liked: true })
      // Everyone inside sees a heart rise from the obra.
      usePresenceStore.getState().react?.(slug, '❤️')
      // Fetch the authoritative count: another tab may have already voted.
      const latest = await getArtworkLike(slug)
      if (latest.count !== undefined) setState({ count: latest.count, liked: latest.liked, signedIn: latest.signedIn })
    } catch {
      setError(t.saveFailed)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
    // errorText/t only change with the language, which reloads the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, signIn])

  useEffect(() => {
    let active = true
    getArtworkLike(slug).then((result) => {
      if (!active) return
      if (!('count' in result) || result.count === undefined) {
        setError(errorText[result.error ?? ''] ?? t.unavailable)
        return
      }
      const loaded = { count: result.count, liked: result.liked, signedIn: result.signedIn }
      setState(loaded)
      // Back from Google with a like pending on this obra: save it.
      if (useInteractionStore.getState().consumeIntent(slug, 'like') && loaded.signedIn && !loaded.liked) void save(loaded)
    }).catch(() => { if (active) setError(t.unavailable) })
    return () => { active = false }
    // errorText/t only change with the language, which reloads the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, retry, save])

  const signedOut = state && !state.signedIn

  return (
    <div className="mt-3 space-y-3">
      <button type="button" onClick={() => state && void save(state)} disabled={!state || busy || state.liked}
        aria-pressed={state?.liked ?? false}
        className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-3 font-semibold disabled:opacity-60">
        {signedOut ? <GoogleIcon /> : <Heart className="h-5 w-5" fill={state?.liked ? 'currentColor' : 'none'} aria-hidden="true" />}
        {busy ? (signedOut ? m.auth.signingIn : t.saving) : state?.liked ? t.liked : signedOut ? t.signIn : t.like}
        {state && <span aria-label={plural(locale, state.count, t.count)}>· {state.count}</span>}
      </button>
      {signedOut && (
        <p className="text-xs text-muted-foreground">
          {t.signInNote} <a href="/politica-de-privacidad" target="_blank" rel="noreferrer" className="underline">{t.privacy}</a>
        </p>
      )}
      {state?.signedIn && !state.liked && <p className="text-xs text-muted-foreground">{t.newsletter}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error} {!state && <button className="underline" onClick={() => { setError(''); setRetry((value) => value + 1) }}>{t.retry}</button>}</p>}
      {state?.liked && <p role="status" className="text-sm text-muted-foreground">{t.thanks}</p>}
    </div>
  )
}
