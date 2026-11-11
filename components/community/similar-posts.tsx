'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/client'
import { imageSrc } from '@/lib/image-src'
import { communityPostPath, type FeedPost } from '@/lib/community'

// "Si te gustó esta" — the same list for everyone, from the CDN.
export function SimilarPosts({ postId, obraId, slug }: { postId?: string; obraId?: string; slug?: string }) {
  const { m } = useI18n()
  const [posts, setPosts] = useState<FeedPost[]>([])
  useEffect(() => {
    const params = new URLSearchParams()
    if (postId) params.set('id', postId)
    if (obraId) params.set('obra', obraId)
    if (slug) params.set('slug', slug)
    if (![...params.keys()].length) return
    let gone = false
    fetch(`/api/comunidad/parecidas?${params}`).then(async (response) => {
      if (!response.ok || gone) return
      const body = await response.json() as { posts?: FeedPost[] }
      if (!gone) setPosts(body.posts ?? [])
    }).catch(() => {})
    return () => { gone = true }
  }, [postId, obraId, slug])
  if (!posts.length) return null
  return (
    <section className="mt-10" aria-label={m.community.seeAll}>
      <h2 className="font-display text-2xl tracking-tight text-ink uppercase">{m.community.seeAll}</h2>
      <ul className="mt-4 grid grid-cols-3 gap-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={communityPostPath(post.id, post.artwork?.slug)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc(post.imageUrl, 320)} alt="" className="aspect-[4/5] w-full rounded-xl object-cover" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}