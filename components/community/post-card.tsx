'use client'

/* eslint-disable @next/next/no-img-element -- photos are already sized by /api/img */

import { useState } from 'react'
import Link from 'next/link'
import { Heart, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react'
import { CommentsSheet } from '@/components/community/comments-sheet'
import { useGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { useI18n } from '@/lib/i18n/client'
import { fmt, formatRelative } from '@/lib/i18n/format'
import { countryCodeToFlag } from '@/lib/participants'
import { imageSrc, imageSrcSet } from '@/lib/image-src'
import { communityPostPath, type FeedPost } from '@/lib/community'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'

export function PostCard({
  post,
  liked,
  mine,
  signedIn,
  onLike,
  onDelete,
}: {
  post: FeedPost
  liked: boolean
  mine: boolean
  signedIn: boolean
  onLike: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { locale, m } = useI18n()
  const t = m.community
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [addedComments, setAddedComments] = useState(0)
  const href = communityPostPath(post.id, post.artwork?.slug)
  const signIn = useGoogleSignIn(href)
  const name = post.official ? t.officialName : post.author.name
  const alt = post.imageAlt || (post.artwork?.title ? post.artwork.title : fmt(t.photoOf, { name }))
  const when = formatRelative(locale, post.createdAt)

  async function share() {
    const url = `${window.location.origin}${href}`
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
      } catch { /* the menu already failed; nothing else to offer */ }
    }
  }

  function like() {
    if (!signedIn) {
      void signIn.start()
      return
    }
    onLike(post.id)
  }

  const image = (
    <img
      src={imageSrc(post.imageUrl, 640)}
      srcSet={imageSrcSet(post.imageUrl, 828)}
      sizes="(min-width: 768px) 320px, 80vw"
      alt={alt}
      loading="lazy"
      className="aspect-[4/5] w-full object-cover"
    />
  )

  return (
    <article id={`post-${post.id}`} className="flex h-full flex-col overflow-hidden rounded-3xl border-2 border-ink/10 bg-card">
      <header className="flex items-center gap-3 p-4">
        {post.official ? (
          <img src="/logo-mark.png" alt="" className="size-10 rounded-full border border-ink/10 object-cover" />
        ) : post.author.thumbUrl ? (
          <img src={imageSrc(post.author.thumbUrl, 128)} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <span className="size-10 rounded-full bg-ink/10" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          {post.official ? (
            <p className="truncate font-semibold text-ink">{t.officialName}</p>
          ) : (
            <Link href={post.author.href} className="truncate font-semibold text-ink hover:underline" onClick={() => track('community_to_profile')}>
              {post.author.name}
            </Link>
          )}
          <p className="text-xs text-muted-foreground">
            {post.author.countryCode && <span className="mr-1" aria-hidden="true">{countryCodeToFlag(post.author.countryCode)}</span>}
            <time dateTime={post.createdAt}>{when}</time>
          </p>
        </div>
        {post.pinned && <span className="rounded-full bg-collage-yellow px-2 py-1 text-xs font-semibold text-ink">{t.prompt}</span>}
        {mine && (
          <div className="relative">
            <button type="button" className="rounded-full p-2 text-ink hover:bg-ink/5" aria-label={t.more} aria-expanded={menu} onClick={() => setMenu((value) => !value)}>
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
            {menu && (
              <button
                type="button"
                className="absolute right-0 z-10 mt-1 whitespace-nowrap rounded-xl border-2 border-ink/10 bg-card px-3 py-2 text-sm font-semibold text-collage-red"
                onClick={() => {
                  setMenu(false)
                  if (window.confirm(t.deleteConfirm)) onDelete(post.id)
                }}
              >
                {t.delete}
              </button>
            )}
          </div>
        )}
      </header>
      {post.artwork ? (
        <Link href={post.artwork.href} onClick={() => track('community_to_obra')}>{image}</Link>
      ) : (
        <button type="button" className="block w-full text-left" onClick={() => { setOpen(true); track('community_post_open') }}>{image}</button>
      )}
      {post.body && (
        <p className={cn('px-4 pt-4 text-sm whitespace-pre-line text-ink', !open && 'line-clamp-4')}>
          {post.body}
        </p>
      )}
      {post.body && !open && (
        <button type="button" className="px-4 pt-1 text-left text-sm font-semibold text-muted-foreground" onClick={() => { setOpen(true); track('community_post_open') }}>
          {t.seeMore}
        </button>
      )}
      {post.original && open && (
        <p className="px-4 pt-2 text-sm whitespace-pre-line text-muted-foreground">{post.original}</p>
      )}
      <footer className="mt-auto flex items-center gap-1 p-3">
        <button type="button" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-ink/5" onClick={like} aria-pressed={liked} disabled={signIn.loading}>
          <Heart className={cn('size-4', liked && 'fill-collage-red text-collage-red')} aria-hidden="true" />
          <span className="sr-only">{t.like}</span>
          {post.likes > 0 && <span>{fmt(t.likes, { count: post.likes })}</span>}
        </button>
        <button type="button" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-ink/5" onClick={() => setSheet(true)}>
          <MessageCircle className="size-4" aria-hidden="true" />
          <span className="sr-only">{t.comments}</span>
          {post.comments + addedComments}
        </button>
        {sheet && (
          <CommentsSheet
            postId={post.id}
            signedIn={signedIn}
            onClose={() => setSheet(false)}
            onPosted={() => setAddedComments((count) => count + 1)}
          />
        )}
        <button type="button" className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-ink/5" onClick={() => void share()}>
          <Share2 className="size-4" aria-hidden="true" />
          {copied ? t.linkCopied : t.share}
        </button>
      </footer>
    </article>
  )
}
