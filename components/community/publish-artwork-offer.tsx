'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { communityViewer, publishArtwork } from '@/app/[locale]/(site)/comunidad/actions'
import { startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { useI18n } from '@/lib/i18n/client'
import { COMMUNITY_POSTING, communityPostPath, POST_BODY_MAX, type CommunityError } from '@/lib/community'
import { withReferral } from '@/lib/referral'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/track'

// The step next to «Imagen para historias»: the obra is already ours, so
// posting it on Comunidad is one tap. The hash #publicar opens it focused,
// which is how the launch mail lands.
export function PublishArtworkOffer({ slug, isPublic, opened }: { slug: string; isPublic: boolean; opened: boolean }) {
  const { m } = useI18n()
  const t = m.community
  const root = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const [ready, setReady] = useState(false)
  const [postId, setPostId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<CommunityError | null>(null)
  const [openedLocal, setOpenedLocal] = useState(false)
  const [justPosted, setJustPosted] = useState(false)
  const expanded = opened || openedLocal
  const back = `/obras/${slug}#publicar`

  useEffect(() => {
    const node = root.current
    if (!node || !isPublic) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      track('community_publish_offer_view')
      observer.disconnect()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [isPublic])

  useEffect(() => {
    let gone = false
    const fromHash = window.location.hash === '#publicar'
    createClient().auth.getSession().then(async ({ data }) => {
      if (gone) return
      if (!data.session) {
        if (fromHash) void startGoogleSignIn(back)
        setReady(true)
        return
      }
      const viewer = await communityViewer({ artworkSlug: slug })
      if (gone) return
      setPostId(viewer.artworkPostId)
      setReady(true)
      if (fromHash) {
        setOpenedLocal(true)
        root.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        field.current?.focus()
      }
    })
    return () => { gone = true }
  }, [slug, back])

  async function publish() {
    setBusy(true)
    setError(null)
    const { data } = await createClient().auth.getSession()
    if (!data.session) {
      setBusy(false)
      void startGoogleSignIn(back)
      return
    }
    const result = await publishArtwork({ artworkSlug: slug, body })
    setBusy(false)
    if ('error' in result) {
      if (result.error === 'signin') void startGoogleSignIn(back)
      else setError(result.error)
      return
    }
    track('community_publish_artwork')
    setJustPosted(true)
    setPostId(result.id)
  }

  if (!isPublic) {
    return <p className="mt-3 text-sm text-muted-foreground">{t.offerPending}</p>
  }

  const href = postId ? communityPostPath(postId, slug) : null

  function invite() {
    if (!postId) return
    const url = `${window.location.origin}${withReferral('/comunidad', slug)}#post-${postId}`
    window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer')
  }

  if (!COMMUNITY_POSTING) return null

  return (
    <div ref={root} className="mt-4 rounded-2xl border-2 border-ink/10 bg-collage-yellow/15 p-4">
      {postId && href ? (
        <div>
          <p className="font-semibold text-ink">{justPosted ? t.offerDone : t.offerAlready}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={href} className="text-sm font-semibold text-ink underline">{t.viewPost}</Link>
            <button type="button" className="text-sm font-semibold text-ink underline" onClick={invite}>{t.inviteFriends}</button>
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void publish() }}>
          <p className="font-semibold text-ink">{t.offerTitle}</p>
          {expanded && <p className="mt-1 text-sm text-muted-foreground">{t.offerBody}</p>}
          {expanded && (
            <textarea
              ref={field}
              value={body}
              maxLength={POST_BODY_MAX}
              rows={3}
              placeholder={t.bodyPlaceholder}
              onChange={(event) => setBody(event.target.value)}
              className="mt-3 w-full rounded-xl border-2 border-ink/15 bg-card px-3 py-2 text-sm text-ink"
            />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50" disabled={busy}>
              {busy ? t.publishing : t.publish}
            </button>
            {!expanded && (
              <button type="button" className="text-sm font-semibold text-ink underline" onClick={() => setOpenedLocal(true)}>{t.bodyPlaceholder}</button>
            )}
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-collage-red">{t.errors[error]}</p>}
        </form>
      )}
    </div>
  )
}
