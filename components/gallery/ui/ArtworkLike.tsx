'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { getArtworkLike, likeArtwork } from '@/app/galeria-3d/actions'

export function ArtworkLike({ slug }: { slug: string }) {
  const [state, setState] = useState<{ count: number; liked: boolean; needsEmail: boolean } | null>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    getArtworkLike(slug).then((result) => {
      if (!active) return
      if ('count' in result && result.count !== undefined) setState({ count: result.count, liked: result.liked, needsEmail: result.needsEmail })
      else setError(result.error ?? 'No pudimos cargar los likes.')
    }).catch(() => { if (active) setError('No pudimos cargar los likes.') })
    return () => { active = false }
  }, [slug, retry])

  async function save() {
    if (busy || state?.liked) return
    if (state?.needsEmail && !showEmail) { setShowEmail(true); return }
    setBusy(true)
    setError('')
    try {
      const result = await likeArtwork(slug, email)
      if (result.error) {
        setError(result.error)
        if (result.needsEmail) setShowEmail(true)
      } else {
        setState((previous) => ({ count: (previous?.count ?? 0) + 1, liked: true, needsEmail: false }))
        setShowEmail(false)
        // Fetch the authoritative count: another tab may have already voted.
        const latest = await getArtworkLike(slug)
        if (latest.count !== undefined) setState({ count: latest.count, liked: latest.liked, needsEmail: latest.needsEmail })
      }
    } catch { setError('No pudimos guardar tu like. Intentá de nuevo.') }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-3 space-y-3">
      <button type="button" onClick={() => void save()} disabled={!state || busy || state.liked}
        aria-pressed={state?.liked ?? false}
        className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-3 font-semibold disabled:opacity-60">
        <Heart className="h-5 w-5" fill={state?.liked ? 'currentColor' : 'none'} aria-hidden="true" />
        {busy ? 'Guardando…' : state?.liked ? 'Te gusta esta obra' : 'Me gusta'}
        {state && <span aria-label={`${state.count} likes`}>· {state.count}</span>}
      </button>
      {!state?.liked && <p className="text-xs text-muted-foreground">Al dar like, te sumás a las novedades del Mundial por mail. Podés darte de baja cuando quieras.</p>}
      {showEmail && (
        <form onSubmit={(event) => { event.preventDefault(); void save() }} className="space-y-3">
          <label htmlFor="gallery-like-email" className="block text-sm font-semibold">Tu mail para guardar el like</label>
          <input id="gallery-like-email" type="email" autoComplete="email" required maxLength={254}
            value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy}
            className="w-full rounded-lg border border-ink/20 bg-paper px-3 py-2" />
          <p className="text-xs text-muted-foreground">No necesitás crear una cuenta. Un like por mail y obra. <a href="/politica-de-privacidad" target="_blank" rel="noreferrer" className="underline">Privacidad</a></p>
          <button type="submit" disabled={busy} className="rounded-lg bg-ink px-4 py-2 text-paper disabled:opacity-60">{busy ? 'Guardando…' : 'Guardar mi like'}</button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error} {!state && <button className="underline" onClick={() => { setError(''); setRetry((value) => value + 1) }}>Reintentar</button>}</p>}
      {state?.liked && <p role="status" className="text-sm text-muted-foreground">¡Gracias! Tu like quedó guardado.</p>}
    </div>
  )
}
