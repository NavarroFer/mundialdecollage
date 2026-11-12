'use client'

/* eslint-disable @next/next/no-img-element -- the obra behind the card is already sized by /api/img */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { communityViewer, deletePost, publishArtwork, togglePostLike } from '@/app/[locale]/(site)/comunidad/actions'
import { PostCard } from '@/components/community/post-card'
import { TrackVisible } from '@/components/track'
import { useI18n } from '@/lib/i18n/client'
import { imageSrc } from '@/lib/image-src'
import { createClient } from '@/lib/supabase/client'
import { STRIP_MIN_POSTS, STRIP_SIZE, communityPostPath, type CommunityError, type FeedPage, type FeedPost } from '@/lib/community'
import { track } from '@/lib/track'

// The home strip. It reads nothing on the server: the page stays as it is,
// and the feed arrives from the CDN once the strip is near the screen.
export function CommunityStrip() {
  const { locale, m } = useI18n()
  const t = m.community
  const root = useRef<HTMLDivElement>(null)
  const [posts, setPosts] = useState<FeedPost[] | null>(null)
  const [unposted, setUnposted] = useState<{ slug: string; image: string | null } | null>(null)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [signedIn, setSignedIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<CommunityError | null>(null)

  useEffect(() => {
    const node = root.current
    if (!node) return
    let gone = false
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const params = new URLSearchParams({ destacadas: '1', lang: locale, n: String(STRIP_SIZE) })
      fetch(`/api/comunidad?${params}`).then(async (response) => {
        if (!response.ok || gone) return
        const page = await response.json() as FeedPage
        if (page.posts.length < STRIP_MIN_POSTS) {
          setPosts([])
          return
        }
        setPosts(page.posts.slice(0, STRIP_SIZE))
        const { data } = await createClient().auth.getSession()
        if (!data.session || gone) return
        const viewer = await communityViewer({ postIds: page.posts.map((post) => post.id) })
        if (gone) return
        setSignedIn(viewer.signedIn)
        setLiked(new Set(viewer.liked))
        setMine(new Set(viewer.mine))
        if (!viewer.unpostedArtworkSlug) return
        const obra = await fetch(`/api/obras/${viewer.unpostedArtworkSlug}`)
        const detail = obra.ok ? await obra.json() as { obra?: { imageUrl?: string } } : null
        if (!gone) setUnposted({ slug: viewer.unpostedArtworkSlug, image: detail?.obra?.imageUrl ?? null })
      }).catch(() => {})
    }, { rootMargin: '600px' })
    observer.observe(node)
    return () => { gone = true; observer.disconnect() }
  }, [locale])

  async function publish() {
    if (!unposted) return
    setBusy(true)
    setError(null)
    const result = await publishArtwork({ artworkSlug: unposted.slug })
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    track('community_publish_artwork')
    window.location.href = communityPostPath(result.id, unposted.slug)
  }

  async function like(id: string) {
    const was = liked.has(id)
    setPosts((current) => current?.map((post) => post.id === id ? { ...post, likes: Math.max(0, post.likes + (was ? -1 : 1)) } : post) ?? null)
    const result = await togglePostLike(id)
    if ('error' in result) return
    track('community_like')
    setLiked((current) => {
      const next = new Set(current)
      if (result.liked) next.add(id)
      else next.delete(id)
      return next
    })
    setPosts((current) => current?.map((post) => post.id === id ? { ...post, likes: result.likes } : post) ?? null)
  }

  if (!posts || posts.length < STRIP_MIN_POSTS) return <div ref={root} className="h-px" aria-hidden="true" />

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8" aria-label={t.stripTitle}>
          <TrackVisible event="community_strip_view" />
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl tracking-tight text-ink uppercase sm:text-4xl">{t.stripTitle}</h2>
            <Link href="/" className="text-sm font-semibold text-ink underline">{t.seeAll}</Link>
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-collage-red">{t.errors[error]}</p>}
          <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto motion-reduce:snap-none md:grid md:grid-cols-3 md:overflow-visible">
            {unposted && (
              <li className="w-[80%] shrink-0 snap-start md:w-auto">
                <div className="relative flex h-full min-h-64 flex-col justify-end overflow-hidden rounded-3xl border-2 border-ink bg-ink p-5 text-paper">
                  {unposted.image && <img src={imageSrc(unposted.image, 640)} alt="" className="absolute inset-0 size-full object-cover opacity-60" />}
                  <div className="relative">
                    <p className="font-display text-2xl tracking-tight uppercase">{t.unposted}</p>
                    <button type="button" className="mt-4 rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink" disabled={busy} onClick={() => void publish()}>
                      {busy ? t.publishing : t.publish}
                    </button>
                  </div>
                </div>
              </li>
            )}
            {posts.map((post) => (
              <li key={post.id} className="w-[80%] shrink-0 snap-start md:w-auto">
                <PostCard post={post} liked={liked.has(post.id)} mine={mine.has(post.id)} signedIn={signedIn} onLike={(id) => void like(id)} onDelete={() => {}} />
              </li>
            ))}
          </ul>
    </section>
  )
}
