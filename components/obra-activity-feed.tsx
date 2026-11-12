'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, MessageCircle } from 'lucide-react'
import { SuggestedArtists } from '@/components/community/suggested-artists'
import { communityViewer } from '@/app/[locale]/(site)/comunidad/actions'
import { addArtworkComment, likeArtwork } from '@/app/[locale]/(site)/galeria-3d/actions'
import { startGoogleSignIn } from '@/components/auth/google-sign-in-button'
import { useI18n } from '@/lib/i18n/client'
import { imageSrc } from '@/lib/image-src'
import { countryCodeToFlag } from '@/lib/participants'
import { fmt } from '@/lib/i18n/format'
import { track } from '@/lib/track'
import { rankForTaste } from '@/lib/community'
import { tagsFromIndexes } from '@/lib/community-tags'
import { createClient } from '@/lib/supabase/client'

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
  /** Indexes into COMMUNITY_TAGS, for «Para vos». */
  tags?: number[]
}

type Page = { obras: ObraCard[]; next: { at: string; id: string } | null }

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
  const { m } = useI18n()
  const t = m.community
  const tabs = m.siteSections
  const [obras, setObras] = useState<ObraCard[] | null>(null)
  const [next, setNext] = useState<Page['next']>(null)
  const [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingNote, setPendingNote] = useState<Record<string, string>>({})
  // «Para vos»: the database computes the taste, the browser orders what it
  // already has. Hidden until there is a taste to read.
  const [sort, setSort] = useState<'recent' | 'foryou'>('recent')
  const [taste, setTaste] = useState<Record<string, number>>({})

  useEffect(() => {
    let gone = false
    createClient().auth.getSession().then(({ data }) => {
      if (gone || !data.session) return
      communityViewer().then((viewer) => { if (!gone) setTaste(viewer.taste) }).catch(() => {})
    }).catch(() => {})
    return () => { gone = true }
  }, [])

  useEffect(() => {
    let gone = false
    load().then((page) => {
      if (gone) return
      setObras(page.obras)
      setNext(page.next)
    }).catch(() => { if (!gone) setError(true) })
    return () => { gone = true }
  }, [])

  const ordered = useMemo(() => {
    const list = obras ?? []
    if (sort !== 'foryou' || Object.keys(taste).length === 0) return list
    return rankForTaste(list.map((obra) => ({
      obra,
      tags: tagsFromIndexes(obra.tags),
      createdAt: obra.activityAt,
      likes: obra.likes,
      comments: obra.comments,
    })), taste).map(({ obra }) => obra)
  }, [obras, sort, taste])

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
    const result = await likeArtwork(slug)
    if ('error' in result) {
      if (result.error === 'sign_in_required') {
        const here = `${window.location.pathname}${window.location.search}${window.location.hash}`
        void startGoogleSignIn(here || '/')
      }
      return
    }
    bump(slug, (obra) => ({ ...obra, likes: obra.likes + 1, activityAt: new Date().toISOString() }))
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

  if (error) return <p role="alert" className="py-16 text-center text-muted-foreground">{t.loadError}</p>
  if (!obras) {
    return (
      <ul className="flex flex-col gap-6" aria-hidden="true">
        {[0, 1].map((item) => <li key={item} className="h-[28rem] animate-pulse rounded-3xl bg-ink/5" />)}
      </ul>
    )
  }
  if (!obras.length) return <p className="py-16 text-center text-muted-foreground">{t.empty}</p>

  return (
    <div>
      {Object.keys(taste).length > 0 && (
        <div className="mb-6 inline-flex rounded-full border-2 border-ink/15 p-1" role="group" aria-label={`${tabs.exploreRecent} / ${tabs.exploreForYou}`}>
          <button
            type="button"
            aria-pressed={sort === 'recent'}
            onClick={() => setSort('recent')}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-collage-blue ${sort === 'recent' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'}`}
          >
            {tabs.exploreRecent}
          </button>
          <button
            type="button"
            aria-pressed={sort === 'foryou'}
            onClick={() => { setSort('foryou'); track('community_foryou_view') }}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-collage-blue ${sort === 'foryou' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'}`}
          >
            {tabs.exploreForYou}
          </button>
        </div>
      )}
      {Object.keys(taste).length > 0 && <div className="mb-6"><SuggestedArtists /></div>}
      <ul className="flex flex-col gap-8">
        {ordered.map((obra) => (
        <li key={obra.id} className="overflow-hidden rounded-3xl border-2 border-ink/10 bg-card">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg" aria-hidden="true">{obra.countryCode ? countryCodeToFlag(obra.countryCode) : ''}</span>
            <p className="min-w-0 truncate font-semibold text-ink">{obra.authorName}</p>
          </div>
          <Link href={`/obras/${obra.slug}`} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc(obra.imageUrl, 828)} alt={obra.title ?? obra.authorName} className="aspect-square w-full object-cover" />
          </Link>
          <div className="px-4 py-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => void like(obra.slug)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 font-semibold text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-collage-blue" aria-label={t.like}>
                <Heart className="h-5 w-5" aria-hidden="true" />
                {obra.likes > 0 && <span>{fmt(t.likes, { count: obra.likes })}</span>}
              </button>
              <span className="inline-flex min-h-11 items-center gap-2 px-2 font-semibold text-ink">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                {obra.comments > 0 && <span>{obra.comments}</span>}
              </span>
            </div>
            {obra.title && <p className="mt-1 font-semibold text-ink">{obra.title}</p>}
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {obra.recent.map((comment) => (
                <li key={`${comment.createdAt}-${comment.author}`}>
                  <span className="font-semibold">{comment.author}</span> {comment.body}
                </li>
              ))}
              {pendingNote[obra.slug] && <li className="text-muted-foreground">{t.inReview}: {pendingNote[obra.slug]}</li>}
            </ul>
            <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void comment(obra.slug) }}>
              <label className="sr-only" htmlFor={`comment-${obra.id}`}>{t.commentPlaceholder}</label>
              <input id={`comment-${obra.id}`} value={drafts[obra.slug] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [obra.slug]: event.target.value }))} placeholder={t.commentPlaceholder} maxLength={500} className="min-h-11 flex-1 rounded-full border-2 border-ink/15 px-4 text-sm focus-visible:outline-2 focus-visible:outline-collage-blue" />
              <button type="submit" className="min-h-11 rounded-full px-3 text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-collage-blue">{t.send}</button>
            </form>
          </div>
        </li>
      ))}
      {next && (
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
    </div>
  )
}
