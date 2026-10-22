'use client'

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import { MessageCircle } from 'lucide-react'
import { addArtworkComment, type GalleryComment } from '@/app/[locale]/(site)/galeria-3d/actions'
import { GoogleIcon, startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { clearCommentDraft, galleryReturnPath, readCommentDraft, saveCommentDraft } from '@/lib/gallery-return'
import { track } from '@/lib/track'
import { useInteractionStore } from '../interaction/store'
import { forgetArtworkSocial } from './artworkSocial'
import styles from '../gallery-theme.module.css'
import { useI18n } from '@/lib/i18n/client'

const MAX_LENGTH = 500
// Each author keeps one tone of the paper palette for their initial.
const AVATAR_TONES = ['var(--collage-blue)', 'var(--collage-red)', '#5f7a3a', 'var(--gallery-ink)']

type CommentsState = { comments: GalleryComment[]; signedIn: boolean }

function avatarTone(author: string) {
  let hash = 0
  for (let i = 0; i < author.length; i++) hash = (hash * 31 + author.charCodeAt(i)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

// Approved comments on this obra, plus the viewer's own still waiting for
// moderation (/admin/comentarios). Writing one needs a Google account: a
// signed-out visitor's draft is kept across the sign-in round trip and sent
// automatically once they're back (lib/gallery-return.ts). `initial` comes
// from the modal's single likes+comments fetch (artworkSocial.ts); `onSent`
// lets the modal follow up once a comment is in (ArtistInvite). `fieldRef`
// lets the ficha's «Comentar» tile jump to the box; `scrollIntoView` brings
// the section up on arrival (the comments button over an obra).
export function ArtworkComments({ slug, initial, onSent, fieldRef, scrollIntoView = false }: {
  slug: string
  initial: CommentsState
  onSent?: () => void
  fieldRef?: RefObject<HTMLTextAreaElement | null>
  scrollIntoView?: boolean
}) {
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
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!scrollIntoView) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sectionRef.current?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
  }, [scrollIntoView])

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
    <section ref={sectionRef} aria-labelledby={headingId} className="scroll-mt-2 space-y-4 border-t border-ink/10 pt-5">
      <h3 id={headingId} className="flex items-center gap-2 text-lg font-bold text-ink">
        <MessageCircle className="size-5" aria-hidden="true" />
        {t.title}
        {state.comments.length > 0 && <span className={styles.ficheBadge}>{state.comments.length}</span>}
      </h3>

      {state.comments.length === 0 && <p className="text-base">{t.none}</p>}
      {state.comments.length > 0 && (
        <ul className="space-y-3">
          {state.comments.map((comment) => (
            <li key={comment.id} className={styles.ficheComment}>
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className={styles.ficheAvatar} style={{ background: avatarTone(comment.author) }}>
                  {Array.from(comment.author.trim())[0]?.toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-bold">{comment.author}</span>
                  <time dateTime={comment.createdAt} className="text-xs opacity-70">{dateFormat.format(new Date(comment.createdAt))}</time>
                </span>
                {comment.pending && <span className="ml-auto shrink-0 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold">{t.pending}</span>}
              </div>
              <p className="mt-2 whitespace-pre-line break-words text-base leading-relaxed">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(event) => { event.preventDefault(); void send(state, draft) }} className="space-y-2">
        <label htmlFor={fieldId} className="sr-only">{t.placeholder}</label>
        <textarea ref={fieldRef} id={fieldId} value={draft} onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_LENGTH} rows={3} placeholder={t.placeholder} disabled={busy} className={styles.ficheField} />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-xs opacity-70">{t.moderationNote}</p>
          <button type="submit" disabled={busy || !draft.trim()} className={styles.ficheSubmit}>
            {!state.signedIn && <GoogleIcon />}
            {busy ? (state.signedIn ? t.sending : m.auth.signingIn) : state.signedIn ? t.send : t.signInToComment}
          </button>
        </div>
      </form>

      {notice && <p role="status" className="text-sm">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  )
}
