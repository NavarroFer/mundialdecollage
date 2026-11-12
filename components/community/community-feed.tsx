'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { communityViewer, deletePost, togglePostLike } from '@/app/[locale]/(site)/comunidad/actions'
import { PostCard } from '@/components/community/post-card'
import { TrackView } from '@/components/track'
import { useI18n } from '@/lib/i18n/client'
import { createClient } from '@/lib/supabase/client'
import {
  FEED_PAGE_SIZE,
  type CommunityError,
  type FeedPage,
  type FeedPost,
} from '@/lib/community'
import { track } from '@/lib/track'

const FRESH_MS = 2 * 60 * 1000

async function loadFeed(params: URLSearchParams): Promise<FeedPage | null> {
  const response = await fetch(`/api/comunidad?${params}`)
  if (!response.ok) return null
  return response.json()
}

export function CommunityFeed({ callOpen, author, hideEmpty = false, title }: { callOpen: boolean; author?: string; hideEmpty?: boolean; title?: string }) {
  const { locale, m } = useI18n()
  const t = m.community
  const [posts, setPosts] = useState<FeedPost[] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [error, setError] = useState<CommunityError | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [canPost, setCanPost] = useState(false)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [fresh, setFresh] = useState<FeedPost[] | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const fetchedAt = useRef(0)
  const loading = useRef(false)

  const query = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams({ lang: locale, n: String(FEED_PAGE_SIZE) })
    if (author) params.set('autor', author)
    for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value)
    return params
  }, [author, locale])

  const remember = useCallback(async (ids: string[]) => {
    const { data } = await createClient().auth.getSession()
    if (!data.session) return
    const viewer = await communityViewer({ postIds: ids })
    setSignedIn(viewer.signedIn)
    setCanPost(viewer.canPost)
    setLiked(new Set(viewer.liked))
    setMine(new Set(viewer.mine))
  }, [])

  useEffect(() => {
    let gone = false
    loadFeed(query()).then(async (page) => {
      if (gone) return
      if (!page) {
        setError('unavailable')
        setPosts([])
        return
      }
      setPosts(page.posts)
      setNext(page.next)
      fetchedAt.current = Date.now()
      const hash = window.location.hash.match(/^#post-([0-9a-f-]{36})$/i)
      if (hash && !page.posts.some((post) => post.id === hash[1])) {
        const one = await fetch(`/api/comunidad/${hash[1]}?lang=${locale}`)
        if (one.ok) {
          const post = await one.json() as FeedPost
          if (!gone) setPosts((current) => current ? [post, ...current.filter((item) => item.id !== post.id)] : [post])
        }
      }
      if (!gone) void remember(page.posts.map((post) => post.id))
    })
    return () => { gone = true }
  }, [locale, query, remember])

  useEffect(() => {
    const node = endRef.current
    if (!node || !next) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || loading.current || !next) return
      loading.current = true
      loadFeed(query({ antes: next })).then((page) => {
        loading.current = false
        if (!page) return
        setPosts((current) => [...(current ?? []), ...page.posts])
        setNext(page.next)
        void remember(page.posts.map((post) => post.id))
      })
    }, { rootMargin: '600px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [next, query, remember])

  useEffect(() => {
    function onShow() {
      if (document.visibilityState !== 'visible' || Date.now() - fetchedAt.current < FRESH_MS) return
      loadFeed(query()).then((page) => {
        fetchedAt.current = Date.now()
        if (!page || !posts) return
        const known = new Set(posts.map((post) => post.id))
        const added = page.posts.filter((post) => !known.has(post.id))
        if (added.length) setFresh(added)
      })
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [posts, query])

  async function like(id: string) {
    const was = liked.has(id)
    setLiked((current) => {
      const nextSet = new Set(current)
      if (was) nextSet.delete(id)
      else nextSet.add(id)
      return nextSet
    })
    setPosts((current) => current?.map((post) => post.id === id ? { ...post, likes: post.likes + (was ? -1 : 1) } : post) ?? null)
    const result = await togglePostLike(id)
    if ('error' in result) {
      setError(result.error)
      setLiked((current) => {
        const nextSet = new Set(current)
        if (was) nextSet.add(id)
        else nextSet.delete(id)
        return nextSet
      })
      setPosts((current) => current?.map((post) => post.id === id ? { ...post, likes: post.likes + (was ? 1 : -1) } : post) ?? null)
      return
    }
    track('community_like')
    setPosts((current) => current?.map((post) => post.id === id ? { ...post, likes: result.likes } : post) ?? null)
    setLiked((current) => {
      const nextSet = new Set(current)
      if (result.liked) nextSet.add(id)
      else nextSet.delete(id)
      return nextSet
    })
  }

  async function remove(id: string) {
    const result = await deletePost(id)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPosts((current) => current?.filter((post) => post.id !== id) ?? null)
  }

  function showFresh() {
    if (!fresh) return
    setPosts((current) => [...fresh, ...(current ?? []).filter((post) => !fresh.some((item) => item.id === post.id))])
    setFresh(null)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  if (posts === null) return hideEmpty ? null : <p className="py-16 text-center text-muted-foreground">{m.notifications.loading}</p>
  if (!posts.length) return hideEmpty && !error ? null : <p className="py-16 text-center text-muted-foreground">{error ? t.errors[error] : t.empty}</p>

  return (
    <div>
      {title && <h2 className="font-display mb-6 text-2xl tracking-tight text-ink uppercase">{title}</h2>}
      {!author && <TrackView event="community_view" />}
      {fresh && (
        <button type="button" className="sticky top-20 z-10 mx-auto mb-4 block rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper" onClick={showFresh}>
          {t.newPosts}
        </button>
      )}
      {error && <p role="alert" className="mb-4 text-sm text-collage-red">{t.errors[error]}</p>}
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.flatMap((post, index) => {
          const card = (
            <li key={post.id}>
              <PostCard post={post} liked={liked.has(post.id)} mine={mine.has(post.id)} signedIn={signedIn} onLike={(id) => void like(id)} onDelete={(id) => void remove(id)} />
            </li>
          )
          if (canPost || index < 3 || (index - 3) % 10 !== 0) return [card]
          // With the call open the card alternates between sending an obra and
          // walking the 3D gallery, where most visitors arrive from: the feed
          // is the way in and back out of it. Closed, it's always the gallery.
          const toOnboarding = callOpen && ((index - 3) / 10) % 2 === 0
          return [card, (
            <li key={`invite-${post.id}`}>
              <Link
                href={toOnboarding ? '/onboarding' : '/galeria-3d'}
                onClick={() => { if (!toOnboarding) track('community_to_gallery') }}
                className="flex h-full items-end rounded-3xl border-2 border-ink bg-collage-yellow p-6 font-display text-2xl tracking-tight text-ink uppercase"
              >
                {toOnboarding ? t.inviteOpen : t.inviteClosed}
              </Link>
            </li>
          )]
        })}
      </ul>
      <div ref={endRef} className="h-8" />
    </div>
  )
}
