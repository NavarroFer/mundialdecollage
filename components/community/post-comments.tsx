'use client'

import { useEffect, useState } from 'react'
import { addPostComment, listPostComments, type PostComment } from '@/app/[locale]/(site)/comunidad/actions'
import { useGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { useI18n } from '@/lib/i18n/client'
import { COMMENT_BODY_MAX, communityPostPath, type CommunityError } from '@/lib/community'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/track'

// Approved comments, plus the reader's own pending ones. The page itself
// stays free of the session; this asks only in the browser.
export function PostComments({ postId }: { postId: string }) {
  const { m } = useI18n()
  const t = m.community
  const signIn = useGoogleSignIn(communityPostPath(postId))
  const [signedIn, setSignedIn] = useState(false)
  const [comments, setComments] = useState<PostComment[] | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState<CommunityError | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let gone = false
    createClient().auth.getSession().then(({ data }) => { if (!gone) setSignedIn(Boolean(data.session)) })
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
    const result = await addPostComment({ postId, body })
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    track('community_comment')
    setComments((current) => [...(current ?? []), {
      id: result.id, name: '', body: body.trim(), createdAt: new Date().toISOString(), pending: result.pending, mine: true,
    }])
    setBody('')
  }

  return (
    <section aria-label={t.comments} className="mt-8">
      <h2 className="font-display text-2xl tracking-tight text-ink uppercase">{t.comments}</h2>
      <ul className="mt-4 space-y-3">
        {comments === null && <li className="text-sm text-muted-foreground">{m.notifications.loading}</li>}
        {comments?.length === 0 && <li className="text-sm text-muted-foreground">{t.empty}</li>}
        {comments?.map((comment) => (
          <li key={comment.id}>
            <p className="text-sm font-semibold text-ink">{comment.name}</p>
            <p className="whitespace-pre-line text-sm text-ink">{comment.body}</p>
            {comment.pending && <p className="text-xs text-muted-foreground">{t.inReview}</p>}
          </li>
        ))}
      </ul>
      <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void send() }}>
        <textarea value={body} maxLength={COMMENT_BODY_MAX} rows={3} placeholder={t.commentPlaceholder} onChange={(event) => setBody(event.target.value)} className="w-full rounded-xl border-2 border-ink/15 px-3 py-2 text-sm" />
        <button type="submit" disabled={busy || !body.trim()} className="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{t.send}</button>
        {error && <p role="alert" className="mt-2 text-sm text-collage-red">{t.errors[error]}</p>}
      </form>
    </section>
  )
}
