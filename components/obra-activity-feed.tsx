'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, MessageCircle, Share2 } from 'lucide-react'
import { addArtworkComment, likeArtwork } from '@/app/[locale]/(site)/galeria-3d/actions'
import { startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { useI18n } from '@/lib/i18n/client'
import { formatRelative, fmt } from '@/lib/i18n/format'
import { imageSrc } from '@/lib/image-src'
import { countryCodeToFlag } from '@/lib/participants'
import { cn } from '@/lib/utils'

type Recent = { author: string; body: string; createdAt: string }
export type ObraCard = {
  id: string
  slug: string
  title: string | null
  imageUrl: string
  authorName: string
  countryCode: string | null
  likes: number
  comments: number
  activityAt: string
  recent: Recent[]
}

type Page = { obras: ObraCard[]; next: { at: string; id: string } | null }
type Sort = 'recent' | 'popular' | 'conversation'

const AVATAR_BG = ['bg-collage-blue/15', 'bg-collage-yellow/30', 'bg-collage-red/15'] as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return letters.toUpperCase() || '?'
}

function avatarBg(name: string) {
  let hash = 0
  for (const char of name) hash = (hash + char.charCodeAt(0)) % AVATAR_BG.length
  return AVATAR_BG[hash]
}

function byRecent(a: ObraCard, b: ObraCard) {
  return Date.parse(b.activityAt) - Date.parse(a.activityAt)
}

function sortObras(obras: ObraCard[], sort: Sort) {
  if (sort === 'recent') return obras
  if (sort === 'conversation') {
    return obras
      .filter((obra) => obra.comments > 0)
      .slice()
      .sort((a, b) => b.comments - a.comments || b.likes - a.likes || byRecent(a, b))
  }
  return obras
    .slice()
    .sort((a, b) => b.likes - a.likes || b.comments - a.comments || byRecent(a, b))
}

function load(cursor?: { at: string; id: string }) {
  const params = new URLSearchParams()
  if (cursor) {
    params.set('antes', cursor.at)
    params.set('id', cursor.id)
  }
  return fetch(`/api/obras/actividad?${params}`).then(async (response) => {
    if (!response.ok) throw new Error(String(response.status))
    return await response.json() as Page
  })
}

export function ObraActivityFeed() {
  const { locale, m } = useI18n()
  const t = m.community
  const [obras, setObras] = useState<ObraCard[] | null>(null)
  const [next, setNext] = useState<Page['next']>(null)
  const [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState<Sort>('recent')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingNote, setPendingNote] = useState<Record<string, string>>({})
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    let gone = false
    load().then((page) => {
      if (gone) return
      setObras(page.obras)
      setNext(page.next)
    }).catch(() => { if (!gone) setError(true) })
    return () => { gone = true }
  }, [])

  const visible = useMemo(() => (obras ? sortObras(obras, sort) : []), [obras, sort])

  function bump(slug: string, patch: (obra: ObraCard) => ObraCard) {
    setObras((current) => {
      if (!current) return current
      const index = current.findIndex((obra) => obra.slug === slug)
      if (index < 0) return current
      const nextCards = current.slice()
      const updated = patch(nextCards[index])
      nextCards.splice(index, 1)
      return [updated, ...nextCards]
    })
  }

  async function like(slug: string) {
    if (liked.has(slug)) return
    const result = await likeArtwork(slug)
    if ('error' in result) {
      if (result.error === 'sign_in_required') {
        const here = `${window.location.pathname}${window.location.search}${window.location.hash}`
        void startGoogleSignIn(here || '/')
      }
      return
    }
    setLiked((current) => new Set(current).add(slug))
    bump(slug, (obra) => ({
      ...obra,
      likes: obra.likes + 1,
      activityAt: new Date().toISOString(),
    }))
  }

  async function comment(slug: string) {
    const body = (drafts[slug] ?? '').trim()
    if (!body) return
    const result = await addArtworkComment(slug, body)
    if ('error' in result) {
      if (result.error === 'sign_in_required') {
        const here = `${window.location.pathname}${window.location.search}${window.location.hash}`
        void startGoogleSignIn(here || '/')
      }
      return
    }
    setDrafts((current) => ({ ...current, [slug]: '' }))
    if (result.comment.pending) {
      setPendingNote((current) => ({ ...current, [slug]: result.comment.body }))
      return
    }
    bump(slug, (obra) => ({
      ...obra,
      comments: obra.comments + 1,
      activityAt: new Date().toISOString(),
      recent: [{ author: result.comment.author, body: result.comment.body, createdAt: result.comment.createdAt }, ...obra.recent].slice(0, 2),
    }))
  }

  async function share(obra: ObraCard) {
    const url = `${window.location.origin}/obras/${obra.slug}`
    const title = obra.title ?? obra.authorName
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(obra.slug)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        setCopied(obra.slug)
      } catch { /* the browser offered no way to share; nothing else to do */ }
    }
  }

  if (error) return <p role="alert" className="py-16 text-center text-muted-foreground">{t.loadError}</p>

  if (!obras) {
    return (
      <ul className="flex flex-col gap-6" aria-hidden="true">
        {[0, 1].map((item) => <li key={item} className="h-[28rem] animate-pulse rounded-3xl bg-ink/5" />)}
      </ul>
    )
  }

  const tabs: { key: Sort; label: string }[] = [
    { key: 'recent', label: t.feedRecent },
    { key: 'popular', label: t.feedPopular },
    { key: 'conversation', label: t.feedConversation },
  ]

  return (
    <div>
      <div role="group" aria-label={t.title} className="flex gap-1 rounded-full border-2 border-ink/10 bg-card p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={sort === tab.key}
            onClick={() => setSort(tab.key)}
            className={cn(
              'min-h-9 flex-1 rounded-full px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue',
              sort === tab.key ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!visible.length ? (
        <p className="py-16 text-center text-muted-foreground">
          {sort === 'conversation' ? t.feedConversationEmpty : t.feedEmpty}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-6">
          {visible.map((obra) => (
            <li key={obra.id}>
              <article className="overflow-hidden rounded-3xl border-2 border-ink/10 bg-card">
                <header className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-ink', avatarBg(obra.authorName))}
                    aria-hidden="true"
                  >
                    {initials(obra.authorName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{obra.authorName}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {obra.countryCode && <span aria-hidden="true">{countryCodeToFlag(obra.countryCode)}</span>}
                      <time dateTime={obra.activityAt}>{formatRelative(locale, obra.activityAt)}</time>
                    </p>
                  </div>
                </header>

                <Link
                  href={`/obras/${obra.slug}`}
                  className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc(obra.imageUrl, 828)}
                    alt={obra.title ?? obra.authorName}
                    className="aspect-square w-full object-cover"
                  />
                </Link>

                <div className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void like(obra.slug)}
                      aria-pressed={liked.has(obra.slug)}
                      aria-label={t.like}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 font-semibold text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-collage-blue"
                    >
                      <Heart className={cn('h-5 w-5', liked.has(obra.slug) && 'fill-collage-red text-collage-red')} aria-hidden="true" />
                      {obra.likes > 0 && <span>{fmt(t.likes, { count: obra.likes })}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById(`comment-${obra.id}`)?.focus()}
                      aria-label={t.comments}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 font-semibold text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-collage-blue"
                    >
                      <MessageCircle className="h-5 w-5" aria-hidden="true" />
                      {obra.comments > 0 && <span>{obra.comments}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => void share(obra)}
                      aria-label={t.share}
                      className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-collage-blue"
                    >
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                      {copied === obra.slug ? t.linkCopied : t.share}
                    </button>
                  </div>

                  {obra.title && <p className="mt-1 font-semibold text-ink">{obra.title}</p>}

                  <ul className="mt-2 space-y-1 text-sm text-ink">
                    {obra.recent.map((item) => (
                      <li key={`${item.createdAt}-${item.author}`}>
                        <span className="font-semibold">{item.author}</span> {item.body}
                      </li>
                    ))}
                    {pendingNote[obra.slug] && <li className="text-muted-foreground">{t.inReview}: {pendingNote[obra.slug]}</li>}
                  </ul>

                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(event) => { event.preventDefault(); void comment(obra.slug) }}
                  >
                    <label className="sr-only" htmlFor={`comment-${obra.id}`}>{t.commentPlaceholder}</label>
                    <input
                      id={`comment-${obra.id}`}
                      value={drafts[obra.slug] ?? ''}
                      onChange={(event) => setDrafts((current) => ({ ...current, [obra.slug]: event.target.value }))}
                      placeholder={t.commentPlaceholder}
                      maxLength={500}
                      className="min-h-11 flex-1 rounded-full border-2 border-ink/15 px-4 text-sm focus-visible:outline-2 focus-visible:outline-collage-blue"
                    />
                    <button
                      type="submit"
                      className="min-h-11 rounded-full px-3 text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-collage-blue"
                    >
                      {t.send}
                    </button>
                  </form>
                </div>
              </article>
            </li>
          ))}
          {next && sort === 'recent' && (
            <li>
              <button
                type="button"
                disabled={loadingMore}
                className="min-h-11 w-full rounded-full border-2 border-ink/15 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-60"
                onClick={() => {
                  setLoadingMore(true)
                  void load(next).then((page) => {
                    setObras((current) => [...(current ?? []), ...page.obras])
                    setNext(page.next)
                  }).finally(() => setLoadingMore(false))
                }}
              >
                {t.seeMore}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
