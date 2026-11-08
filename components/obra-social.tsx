'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Heart, MessageCircle } from 'lucide-react'
import {
  addArtworkComment,
  getArtworkLike,
  likeArtwork,
  type ArtworkSocial,
  type GalleryComment,
} from '@/app/[locale]/(site)/galeria-3d/actions'
import { GoogleIcon, startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { forgetArtworkSocial, loadArtworkSocial } from '@/components/gallery/ui/artworkSocial'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { clearCommentDraft, readCommentDraft, saveCommentDraft } from '@/lib/gallery-return'
import { useI18n } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/locales'
import { formatDayMonth, plural } from '@/lib/i18n/format'
import { consumeProfileIntent, OBRA_LIKED_EVENT, profileReturnPath } from '@/lib/profile-return'
import { track } from '@/lib/track'

type LikeState = ArtworkSocial['like']
type CommentsState = ArtworkSocial['comments']

const MAX_LENGTH = 500
// Each author keeps one tone of the paper palette for their initial.
const AVATAR_TONES = ['var(--collage-blue)', 'var(--collage-red-ink)', 'var(--free-shipping)', 'var(--ink)']

function avatarTone(author: string) {
  let hash = 0
  for (let i = 0; i < author.length; i++) hash = (hash * 31 + author.charCodeAt(i)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

const field =
  'w-full rounded-xl border-2 border-ink/15 bg-background px-4 py-3 text-base text-ink focus-visible:border-collage-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:opacity-60'

// Likes and comments on an obra opened from an artist's profile. They are the
// 3D gallery's own (same server actions, tables, moderation and limits —
// app/[locale]/(site)/galeria-3d/actions.ts); only the look is the site's.
// Everything personal (did I like it, who am I, my pending comments) comes
// from one server action when the popup opens, so the profile page itself
// stays static and cached. A visitor without a Google session is sent
// through Google and comes back to the profile (lib/profile-return.ts).
export function ObraSocial({ slug, artistHref }: { slug: string; artistHref: string }) {
  const { m } = useI18n()
  // undefined while it loads, null if it couldn't.
  const [social, setSocial] = useState<ArtworkSocial | null | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    loadArtworkSocial(slug).then(
      (result) => { if (current) setSocial('error' in result ? null : result) },
      () => { if (current) setSocial(null) },
    )
    return () => { current = false }
  }, [slug, attempt])

  if (social === undefined) {
    return (
      <div role="status" className="mt-10 border-t-2 border-ink/10 pt-8">
        <span className="sr-only">{m.artwork.loading}</span>
        <Skeleton className="h-12 w-48" />
        <Skeleton className="mt-6 h-6 w-1/2" />
      </div>
    )
  }

  if (social === null) {
    return (
      <div role="alert" className="mt-10 border-t-2 border-ink/10 pt-8">
        <p className="text-base text-ink">{m.gallery.comments.unavailable}</p>
        <button
          type="button"
          onClick={() => { setSocial(undefined); setAttempt((n) => n + 1) }}
          className="mt-3 inline-flex min-h-12 items-center text-base font-semibold text-collage-blue underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue"
        >
          {m.gallery.like.retry}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-10 border-t-2 border-ink/10 pt-8">
      <LikeButton slug={slug} artistHref={artistHref} initial={social.like} />
      <Comments slug={slug} artistHref={artistHref} initial={social.comments} />
    </div>
  )
}

function LikeButton({ slug, artistHref, initial }: { slug: string; artistHref: string; initial: LikeState }) {
  const { locale, m } = useI18n()
  const t = m.gallery.like
  const [state, setState] = useState<LikeState>(initial)
  const [busy, setBusy] = useState(false)
  // A signed-out visitor pressed the heart: offer Google right under it.
  const [askSignIn, setAskSignIn] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)

  const signIn = useCallback(async () => {
    track('sign_in_start')
    setRedirecting(true)
    const { error: failed } = await startGoogleSignIn(profileReturnPath(artistHref, { slug, intent: 'like' }))
    if (failed) {
      setRedirecting(false)
      setError(t.saveFailed)
    }
  }, [artistHref, slug, t.saveFailed])

  const save = useCallback(async (current: LikeState) => {
    if (busyRef.current || current.liked) return
    if (!current.signedIn) {
      setAskSignIn(true)
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    // Shown at once; a failure takes it back.
    setState({ ...current, count: current.count + 1, liked: true })
    try {
      const result = await likeArtwork(slug)
      if (result.error === 'sign_in_required') {
        setState(current)
        setAskSignIn(true)
        return
      }
      if (result.error) {
        setState(current)
        setError(result.error === 'unavailable' ? t.unavailable : t.saveFailed)
        return
      }
      forgetArtworkSocial(slug)
      track('like_saved')
      window.dispatchEvent(new CustomEvent(OBRA_LIKED_EVENT, { detail: { slug } }))
      // The authoritative count: another tab may have already voted.
      const latest = await getArtworkLike(slug)
      if (!('error' in latest)) setState(latest)
    } catch {
      setState(current)
      setError(t.saveFailed)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [slug, t.saveFailed, t.unavailable])

  // Back from Google with a like pending on this obra: save it.
  useEffect(() => {
    // Resuming an action from before the sign-in round trip, once per return.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (consumeProfileIntent(slug, 'like') && initial.signedIn && !initial.liked) void save(initial)
  }, [slug, initial, save])

  return (
    <div>
      <button
        type="button"
        onClick={() => { track('like_click'); void save(state) }}
        disabled={busy || redirecting || state.liked}
        aria-pressed={state.liked}
        aria-expanded={!state.signedIn ? askSignIn : undefined}
        className="inline-flex min-h-12 items-center gap-3 rounded-full border-2 border-ink/15 bg-card px-5 py-2 text-base font-semibold text-ink transition hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue disabled:cursor-default motion-reduce:transition-none"
      >
        <Heart className={`size-5 ${state.liked ? 'fill-collage-red text-collage-red' : 'text-collage-red'}`} aria-hidden="true" />
        <span>{state.liked ? t.liked : t.like}</span>
        <span className="text-muted-foreground" aria-live="polite">{plural(locale, state.count, t.count)}</span>
      </button>

      {askSignIn && !state.liked && (
        <div className="mt-4 space-y-3 rounded-2xl border-2 border-ink/10 bg-paper p-5">
          <p className="text-base font-semibold text-ink">{t.signIn}</p>
          <Button type="button" variant="outline" size="lg" onClick={() => void signIn()} disabled={redirecting} autoFocus className="h-auto min-h-12 gap-2">
            <GoogleIcon />
            {redirecting ? m.auth.signingIn : m.auth.signIn}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t.signInNote} <a href="/politica-de-privacidad" target="_blank" rel="noreferrer" className="underline">{t.privacy}</a>
          </p>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-base text-collage-red-ink">{error}</p>}
      {state.signedIn && !state.liked && <p className="mt-3 text-sm text-muted-foreground">{t.newsletter}</p>}
      {state.liked && <p role="status" className="mt-3 text-base text-muted-foreground">{t.thanks}</p>}
    </div>
  )
}

function Comments({ slug, artistHref, initial }: { slug: string; artistHref: string; initial: CommentsState }) {
  const { locale, m } = useI18n()
  const t = m.gallery.comments
  const [state, setState] = useState<CommentsState>(initial)
  const [draft, setDraft] = useState(() => readCommentDraft(slug))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const busyRef = useRef(false)
  const headingId = useId()
  const fieldId = useId()
  const errorText = {
    unavailable: t.unavailable, save_failed: t.failed, too_long: t.tooLong, rate_limited: t.rateLimited, empty: t.empty,
  } as Record<string, string>

  const signIn = useCallback(async (text: string) => {
    track('sign_in_start')
    saveCommentDraft(slug, text)
    setBusy(true)
    const { error: failed } = await startGoogleSignIn(profileReturnPath(artistHref, { slug, intent: 'comment' }))
    if (failed) {
      setBusy(false)
      setError(t.failed)
    }
  }, [artistHref, slug, t.failed])

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
  }, [slug, signIn])

  // Back from Google with a comment drafted for this obra: send it.
  useEffect(() => {
    if (!consumeProfileIntent(slug, 'comment')) return
    const saved = readCommentDraft(slug)
    // Resuming an action from before the sign-in round trip, once per return.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial.signedIn && saved.trim()) void send(initial, saved)
  }, [slug, initial, send])

  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2 id={headingId} className="font-display flex items-center gap-3 text-2xl tracking-tight text-ink uppercase">
        <MessageCircle className="size-6" aria-hidden="true" />
        {t.title}
        {state.comments.length > 0 && <span className="text-muted-foreground">{state.comments.length}</span>}
      </h2>

      {state.comments.length === 0 ? (
        <p className="mt-4 text-base text-muted-foreground">{t.none}</p>
      ) : (
        <ul className="mt-4 divide-y-2 divide-ink/5">
          {state.comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} locale={locale} pendingLabel={t.pending} />
          ))}
        </ul>
      )}

      <form onSubmit={(event) => { event.preventDefault(); void send(state, draft) }} className="mt-6 space-y-3">
        <label htmlFor={fieldId} className="sr-only">{t.placeholder}</label>
        <textarea
          id={fieldId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_LENGTH}
          rows={3}
          placeholder={t.placeholder}
          disabled={busy}
          className={field}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="text-sm text-muted-foreground">{t.moderationNote}</p>
          <Button type="submit" variant="primary" size="lg" disabled={busy || !draft.trim()} className="h-auto min-h-12 gap-2">
            {!state.signedIn && <GoogleIcon />}
            {busy ? (state.signedIn ? t.sending : m.auth.signingIn) : state.signedIn ? t.send : t.signInToComment}
          </Button>
        </div>
      </form>

      {notice && <p role="status" className="mt-3 text-base text-ink">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-base text-collage-red-ink">{error}</p>}
    </section>
  )
}

function CommentItem({ comment, locale, pendingLabel }: { comment: GalleryComment; locale: Locale; pendingLabel: string }) {
  return (
    <li className="py-4 first:pt-0">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-paper"
          style={{ background: avatarTone(comment.author) }}
        >
          {Array.from(comment.author.trim())[0]?.toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-base font-bold text-ink">{comment.author}</span>
          <time dateTime={comment.createdAt} className="text-sm text-muted-foreground">{formatDayMonth(locale, comment.createdAt)}</time>
        </span>
        {comment.pending && (
          <span className="ml-auto shrink-0 rounded-full bg-ink/10 px-3 py-1 text-sm font-semibold text-ink">{pendingLabel}</span>
        )}
      </div>
      <p className="mt-2 break-words whitespace-pre-line text-base leading-relaxed text-ink">{comment.body}</p>
    </li>
  )
}
