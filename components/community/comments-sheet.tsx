'use client'

import { useEffect, useState } from 'react'
import { addPostComment, listPostComments, type PostComment } from '@/app/[locale]/(site)/comunidad/actions'
import { useGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { useI18n } from '@/lib/i18n/client'
import { COMMENT_BODY_MAX, communityPostPath, type CommunityError } from '@/lib/community'
import { track } from '@/lib/track'

export function CommentsSheet({ postId, signedIn, onClose, onPosted }: {
  postId: string
  signedIn: boolean
  onClose: () => void
  onPosted: () => void
}) {
  const { m } = useI18n()
  const t = m.community
  const signIn = useGoogleSignIn(communityPostPath(postId))
  const [comments, setComments] = useState<PostComment[] | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState<CommunityError | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let gone = false
    listPostComments(postId).then((result) => {
      if (gone) return
      if ('error' in result) setError(result.error)
      else setComments(result.comments)
    })
    return () => { gone = true }
  }, [postId])

  async function send() {
    if (!signedIn) {
      void signIn.start()
      return
    }
    setBusy(true)
    setError(null)
    const result = await addPostComment({ postId, body })
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    track('community_comment')
    setBody('')
    setComments((current) => [...(current ?? []), {
      id: result.id,
      name: '',
      body: body.trim(),
      createdAt: new Date().toISOString(),
      pending: result.pending,
      mine: true,
    }])
    if (!result.pending) onPosted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label={m.notifications.close} onClick={onClose} />
      <div role="dialog" aria-labelledby={`comments-${postId}`} className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-3xl bg-card p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id={`comments-${postId}`} className="font-display text-2xl tracking-tight text-ink uppercase">{t.comments}</h2>
          <button type="button" className="text-sm font-semibold text-ink" onClick={onClose}>{m.notifications.close}</button>
        </div>
        <ul className="mt-4 flex-1 space-y-3 overflow-y-auto">
          {comments === null && <li className="text-sm text-muted-foreground">{m.notifications.loading}</li>}
          {comments?.length === 0 && <li className="text-sm text-muted-foreground">{t.empty}</li>}
          {comments?.map((comment) => (
            <li key={comment.id} className="text-sm">
              <p className="font-semibold text-ink">{comment.name || t.comments}</p>
              <p className="whitespace-pre-line text-ink">{comment.body}</p>
              {comment.pending && <p className="text-xs text-muted-foreground">{t.inReview}</p>}
            </li>
          ))}
        </ul>
        <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void send() }}>
          <textarea value={body} maxLength={COMMENT_BODY_MAX} rows={2} placeholder={t.commentPlaceholder} onChange={(event) => setBody(event.target.value)} className="w-full rounded-xl border-2 border-ink/15 px-3 py-2 text-sm" />
          <button type="submit" className="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50" disabled={busy || !body.trim()}>
            {t.send}
          </button>
          {error && <p role="alert" className="mt-2 text-sm text-collage-red">{t.errors[error]}</p>}
          {comments?.some((comment) => comment.pending && comment.mine) && <p className="mt-2 text-xs text-muted-foreground">{t.commentPending}</p>}
        </form>
      </div>
    </div>
  )
}
