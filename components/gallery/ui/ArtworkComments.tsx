'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { addArtworkComment, type GalleryComment } from '@/app/[locale]/(site)/galeria-3d/actions'
import { GoogleIcon, startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { clearCommentDraft, galleryReturnPath, readCommentDraft, saveCommentDraft } from '@/lib/gallery-return'
import { track } from '@/lib/track'
import { useInteractionStore } from '../interaction/store'
import { forgetArtworkSocial } from './artworkSocial'
import { useI18n } from '@/lib/i18n/client'

const MAX_LENGTH = 500

type CommentsState = { comments: GalleryComment[]; signedIn: boolean }

// Approved comments on this obra, plus the viewer's own still waiting for
// moderation (/admin/comentarios). Writing one needs a Google account: a
// signed-out visitor's draft is kept across the sign-in round trip and sent
// automatically once they're back (lib/gallery-return.ts). `initial` comes
// from the modal's single likes+comments fetch (artworkSocial.ts); `onSent`
// lets the modal follow up once a comment is in (ArtistInvite).
export function ArtworkComments({ slug, initial, onSent }: { slug: string; initial: CommentsState; onSent?: () => void }) {
  const [state, setState] = useState<CommentsState>(initial)
  const [draft, setDraft] = useState(() => readCommentDraft(slug))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const busyRef = useRef(false)
  const { locale, m } = useI18n()
  const t = m.gallery.comments
  const errorText = {
    unavailable: t.unavailable, save_failed: t.failed, too_long: t.tooLong, rate_limited: t.rateLimited, empty: t.empty,
  } as Record<string, string>
  const headingId = useId()
  const fieldId = useId()

  const signIn = useCallback(async (text: string) => {
    track('sign_in_start')
    saveCommentDraft(slug, text)
    setBusy(true)
    await startGoogleSignIn(galleryReturnPath({ slug, intent: 'comment' }))
  }, [slug])

  const send = useCallback(async (current: CommentsState, text: string) => {
    const body = text.trim()
    if (busyRef.current || !body) return
    if (body.length > MAX_LENGTH) {
      setError(t.tooLong)
      return
    }
    if (!current.signedIn) return signIn(body)
    busyRef.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await addArtworkComment(slug, body)
      if ('comment' in result) {
        setState({ ...current, comments: [...current.comments, result.comment] })
        setDraft('')
        clearCommentDraft(slug)
        forgetArtworkSocial(slug)
        setNotice(t.sent)
        track('comment_sent')
        onSent?.()
      } else if (result.error === 'sign_in_required') {
        return signIn(body)
      } else {
        setError(errorText[result.error] ?? t.failed)
      }
    } catch {
      setError(t.failed)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
    // errorText/t only change with the language, which reloads the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, signIn, onSent])

  // Back from Google with a comment drafted for this obra: send it.
  useEffect(() => {
    if (!useInteractionStore.getState().consumeIntent(slug, 'comment')) return
    const saved = readCommentDraft(slug)
    // Resuming an action from before the sign-in round trip, once per return.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial.signedIn && saved.trim()) void send(initial, saved)
  }, [slug, initial, send])

  const dateFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })

  return (
    <section aria-labelledby={headingId} className="mt-2 space-y-3 border-t border-ink/10 pt-4">
      <h3 id={headingId} className="text-sm font-bold tracking-wide text-ink uppercase">{t.title}</h3>

      {state.comments.length === 0 && <p className="text-sm text-muted-foreground">{t.none}</p>}
      {state.comments.length > 0 && (
        <ul className="space-y-3">
          {state.comments.map((comment) => (
            <li key={comment.id} className="text-sm">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-ink">{comment.author}</span>
                {' · '}
                <time dateTime={comment.createdAt}>{dateFormat.format(new Date(comment.createdAt))}</time>
                {comment.pending && <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 font-semibold">{t.pending}</span>}
              </p>
              <p className="mt-1 whitespace-pre-line break-words text-ink/90">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(event) => { event.preventDefault(); void send(state, draft) }} className="space-y-2">
        <label htmlFor={fieldId} className="sr-only">{t.placeholder}</label>
        <textarea id={fieldId} value={draft} onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_LENGTH} rows={3} placeholder={t.placeholder} disabled={busy}
          className="w-full resize-none rounded-lg border border-ink/20 bg-paper px-3 py-2 text-sm" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t.moderationNote}</p>
          <button type="submit" disabled={busy || !draft.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60">
            {!state.signedIn && <GoogleIcon />}
            {busy ? (state.signedIn ? t.sending : m.auth.signingIn) : state.signedIn ? t.send : t.signInToComment}
          </button>
        </div>
      </form>

      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  )
}
