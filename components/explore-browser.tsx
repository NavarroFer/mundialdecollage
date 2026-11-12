'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SuggestedArtists } from '@/components/community/suggested-artists'
import { communityViewer } from '@/app/[locale]/(site)/comunidad/actions'
import { artistProfileSlug } from '@/lib/artist-slug'
import { buildSearchIndex, searchArtists, searchIndex, type ObraEntry } from '@/lib/artwork-search'
import { rankForTaste } from '@/lib/community'
import { tagsFromIndexes } from '@/lib/community-tags'
import { useI18n } from '@/lib/i18n/client'
import { imageSrc } from '@/lib/image-src'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/track'

// The cached list has every published obra (1000+); the grid shows them a page at a time.
const PAGE_SIZE = 48

// The whole published list comes from the CDN (/api/obras). Filters run here.
export function ExploreBrowser() {
  const { locale, m } = useI18n()
  const t = m.siteSections
  const [entries, setEntries] = useState<ObraEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('')
  const [technique, setTechnique] = useState('')
  // «Para vos» needs a session and enough signals. The database computes the
  // taste once; the order is built here, over the same cached list for everyone.
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
    fetch('/api/obras').then(async (response) => {
      if (!response.ok) throw new Error(String(response.status))
      const list = await response.json() as ObraEntry[]
      if (!gone) setEntries(list)
    }).catch(() => { if (!gone) setFailed(true) })
    return () => { gone = true }
  }, [])

  const countries = useMemo(() => [...new Set((entries ?? []).map((entry) => entry.countryCode).filter(Boolean))].sort(), [entries])
  const techniques = useMemo(() => [...new Set((entries ?? []).map((entry) => entry.technique).filter((value): value is string => Boolean(value)))].sort(), [entries])
  const narrowed = useMemo(() => (entries ?? []).filter((entry) => (
    (!country || entry.countryCode === country) && (!technique || entry.technique === technique)
  )), [entries, country, technique])
  const index = useMemo(() => buildSearchIndex(narrowed, (code) => countryCodeToName(code, locale)), [narrowed, locale])
  const obras = query.trim() ? searchIndex(index, query) : narrowed
  const artists = query.trim() ? searchArtists(index, query, 8) : []
  // Pinned never applies here; the obras carry their tags as indexes.
  const ordered = useMemo(() => {
    if (sort !== 'foryou' || Object.keys(taste).length === 0) return obras
    return rankForTaste(obras.map((entry) => ({ entry, tags: tagsFromIndexes(entry.tags) })), taste)
      .map(({ entry }) => entry)
  }, [obras, sort, taste])

  // Back to the first page whenever the search, a filter or the order changes.
  const viewKey = `${query}|${country}|${technique}|${sort}`
  const [paging, setPaging] = useState({ key: viewKey, count: PAGE_SIZE })
  const shown = paging.key === viewKey ? paging.count : PAGE_SIZE

  if (failed) return <p role="alert" className="py-16 text-center text-muted-foreground">{m.community.loadError}</p>
  if (!entries) return <div className="mt-8 h-64 motion-safe:animate-pulse rounded-3xl bg-ink/5" aria-hidden="true" />

  return (
    <div>
      <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block">
          <span className="sr-only">{t.exploreSearch}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.exploreSearch} className="min-h-12 w-full rounded-full border-2 border-ink/15 bg-paper px-4 text-base focus-visible:outline-2 focus-visible:outline-collage-blue" />
        </label>
        <label className="block text-sm font-semibold text-ink">
          <span className="mb-1 block">{t.exploreCountry}</span>
          <select value={country} onChange={(event) => setCountry(event.target.value)} className="min-h-12 rounded-full border-2 border-ink/15 bg-paper px-3 focus-visible:outline-2 focus-visible:outline-collage-blue">
            <option value="">{t.exploreAll}</option>
            {countries.map((code) => <option key={code} value={code}>{countryCodeToFlag(code)} {countryCodeToName(code, locale)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          <span className="mb-1 block">{t.exploreTechnique}</span>
          <select value={technique} onChange={(event) => setTechnique(event.target.value)} className="min-h-12 rounded-full border-2 border-ink/15 bg-paper px-3 focus-visible:outline-2 focus-visible:outline-collage-blue">
            <option value="">{t.exploreAll}</option>
            {techniques.map((name) => <option key={name} value={name}>{m.common.techniques[name] ?? name}</option>)}
          </select>
        </label>
      </div>
      {Object.keys(taste).length > 0 && (
        <div className="mt-6 inline-flex rounded-full border-2 border-ink/15 p-1" role="group" aria-label={`${t.exploreRecent} / ${t.exploreForYou}`}>
          <button
            type="button"
            aria-pressed={sort === 'recent'}
            onClick={() => setSort('recent')}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-collage-blue ${sort === 'recent' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'}`}
          >
            {t.exploreRecent}
          </button>
          <button
            type="button"
            aria-pressed={sort === 'foryou'}
            onClick={() => { setSort('foryou'); track('community_foryou_view') }}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-collage-blue ${sort === 'foryou' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'}`}
          >
            {t.exploreForYou}
          </button>
        </div>
      )}
      {Object.keys(taste).length > 0 && !query.trim() && <SuggestedArtists />}
      {artists.length > 0 && (
        <section className="mt-8" aria-label={t.exploreArtists}>
          <h2 className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{t.exploreArtists}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {artists.map((artist) => (
              <li key={artist.profileId}>
                <Link href={`/artistas/${artistProfileSlug(artist.name, artist.profileId)}`} className="inline-flex min-h-11 items-center rounded-full border-2 border-ink/15 px-4 font-semibold text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-collage-blue">
                  {artist.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {obras.length === 0 ? <p className="py-16 text-center text-muted-foreground">{t.exploreEmpty}</p> : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.slice(0, shown).map((obra) => (
            <li key={obra.slug}>
              <Link href={`/obras/${obra.slug}`} className="block overflow-hidden rounded-2xl border-2 border-ink/10 bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc(obra.imageUrl, 480)} alt="" loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" />
                <p className="truncate px-3 pt-3 text-sm font-semibold text-ink">{obra.title || obra.name}</p>
                <p className="truncate px-3 pb-3 text-xs text-muted-foreground">{obra.countryCode ? `${countryCodeToFlag(obra.countryCode)} ` : ''}{obra.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {ordered.length > shown && (
        <button
          type="button"
          onClick={() => setPaging({ key: viewKey, count: shown + PAGE_SIZE })}
          className="mt-6 min-h-11 w-full rounded-full border-2 border-ink/15 text-sm font-semibold text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-collage-blue"
        >
          {m.community.loadMore}
        </button>
      )}
    </div>
  )
}
