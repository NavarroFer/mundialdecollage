'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { artistProfileSlug } from '@/lib/artist-slug'
import { buildSearchIndex, searchArtists, searchIndex, type ObraEntry } from '@/lib/artwork-search'
import { useI18n } from '@/lib/i18n/client'
import { imageSrc } from '@/lib/image-src'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'

// The whole published list comes from the CDN (/api/obras). Filters run here.
export function ExploreBrowser() {
  const { locale, m } = useI18n()
  const t = m.siteSections
  const [entries, setEntries] = useState<ObraEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('')
  const [technique, setTechnique] = useState('')

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

  if (failed) return <p role="alert" className="py-16 text-center text-muted-foreground">{m.community.loadError}</p>
  if (!entries) return <div className="mt-8 h-64 animate-pulse rounded-3xl bg-ink/5" aria-hidden="true" />

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
          {obras.map((obra) => (
            <li key={obra.slug}>
              <Link href={`/obras/${obra.slug}`} className="block overflow-hidden rounded-2xl border-2 border-ink/10 bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc(obra.imageUrl, 480)} alt="" className="aspect-[4/5] w-full object-cover" />
                <p className="truncate px-3 pt-3 text-sm font-semibold text-ink">{obra.title || obra.name}</p>
                <p className="truncate px-3 pb-3 text-xs text-muted-foreground">{obra.countryCode ? `${countryCodeToFlag(obra.countryCode)} ` : ''}{obra.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
