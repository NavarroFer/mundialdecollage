'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserRound, X } from 'lucide-react'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { buildSearchIndex, searchArtists, searchIndex, type ArtistMatch, type ObraEntry } from '@/lib/artwork-search'
import { artistProfileSlug } from '@/lib/artist-slug'
import { TrackedLink } from '@/components/track'
import { track } from '@/lib/track'
import { loadObras } from '@/lib/obras-client'
import { ObraLink, useOpenObra } from '@/components/obra-modal'
import { useI18n } from '@/lib/i18n/client'
import { fmt, plural } from '@/lib/i18n/format'

type Status = 'idle' | 'loading' | 'ready' | 'error'

const RESULTS_PAGE = 8

const artistHref = (artist: ArtistMatch) => `/artistas/${artistProfileSlug(artist.name, artist.profileId)}`

const toSummary = ({ slug, title, name, countryCode, imageUrl }: ObraEntry) => ({ slug, artworkTitle: title, name, countryCode, imageUrl })

// Search over every published obra, on the homepage and (compact) in the
// app header. Opening it also invites signed-out artists to sign up and see
// their own obra.
export function ArtworkSearch({ signedIn, compact = false }: { signedIn: boolean; compact?: boolean }) {
  const { locale, m } = useI18n()
  const router = useRouter()
  const openObra = useOpenObra()
  const [entries, setEntries] = useState<ObraEntry[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [visible, setVisible] = useState(RESULTS_PAGE)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Called as soon as the visitor reaches for the search (hover, touch or
  // focus), so the list is usually here before the first letter is typed —
  // if the map hasn't already fetched it (lib/obras-client.ts).
  function prepare() {
    if (status === 'loading' || status === 'ready') return
    setStatus('loading')
    loadObras().then(
      (list) => { setEntries(list); setStatus('ready') },
      () => setStatus('error'),
    )
  }

  const index = useMemo(
    () => buildSearchIndex(entries, (code) => countryCodeToName(code, locale)),
    [entries, locale],
  )
  const matches = useMemo(() => searchIndex(index, query), [index, query])
  const results = matches.slice(0, visible)
  // Artists whose name matches go first, as links to their profile; the
  // keyboard walks them and then the obras as one list.
  const artists = useMemo(() => searchArtists(index, query), [index, query])
  const optionCount = artists.length + results.length

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!optionCount) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + optionCount) % optionCount)
    } else if (event.key === 'Enter') {
      const position = Math.max(active, 0)
      if (position < artists.length) {
        setOpen(false)
        track('search_artist_profile_click')
        router.push(artistHref(artists[position]))
        return
      }
      const chosen = results[position - artists.length]
      if (!chosen) return
      setOpen(false)
      if (openObra) openObra(toSummary(chosen))
      else router.push(`/obras/${chosen.slug}`)
    }
  }

  const typed = query.trim().length > 0
  const showList = typed && status === 'ready' && optionCount > 0

  return (
    <div ref={rootRef} className={`relative w-full text-left ${compact ? 'max-w-lg' : 'mx-auto max-w-xl'}`} onPointerEnter={prepare}>
      <div role="search" className="relative">
        <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink/60 ${compact ? 'left-4 size-4' : 'left-5 size-5'}`} aria-hidden="true" />
        <input
          type="search"
          role="combobox"
          aria-label={m.search.label}
          aria-expanded={open && showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          value={query}
          placeholder={m.search.placeholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          onTouchStart={prepare}
          onFocus={() => { prepare(); setOpen(true) }}
          onChange={(event) => { setQuery(event.target.value); setActive(-1); setVisible(RESULTS_PAGE); setOpen(true) }}
          onKeyDown={onKeyDown}
          className={`w-full rounded-full border-2 border-ink bg-card text-ink placeholder:text-muted-foreground focus:border-collage-blue focus:outline-none [&::-webkit-search-cancel-button]:hidden ${
            compact
              ? 'h-11 pr-11 pl-10 text-base shadow-[3px_3px_0_0] shadow-ink focus:shadow-collage-blue'
              : 'h-14 pr-12 pl-13 text-base shadow-[4px_4px_0_0] shadow-ink focus:shadow-collage-blue sm:h-16 sm:text-lg'
          }`}
        />
        {typed && (
          <button
            type="button"
            onClick={() => { setQuery(''); setActive(-1); setVisible(RESULTS_PAGE) }}
            className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full text-ink/60 hover:text-ink ${compact ? 'right-1.5 size-9' : 'right-3 size-10'}`}
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">{m.search.clear}</span>
          </button>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {typed && status === 'ready' ? plural(locale, matches.length, m.search.results) : ''}
      </p>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-3 overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-[6px_6px_0_0] shadow-ink">
          {showList ? (
            <>
              <ul id={listId} role="listbox" aria-label={m.search.label} className="max-h-[50vh] overflow-y-auto py-2">
                {artists.map((artist, index) => (
                  <li key={artist.profileId} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                    <TrackedLink
                      href={artistHref(artist)}
                      prefetch={false}
                      event="search_artist_profile_click"
                      tabIndex={-1}
                      onPointerEnter={() => setActive(index)}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-12 items-center gap-3 px-5 py-2 ${index === active ? 'bg-collage-blue/10' : ''}`}
                    >
                      <UserRound className="size-5 shrink-0 text-collage-red" aria-hidden="true" />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold text-ink">{artist.name}</span>
                        <span className="text-sm text-muted-foreground">
                          <span aria-hidden>{countryCodeToFlag(artist.countryCode)}</span> {m.search.artistProfile} · {artist.artworks} {plural(locale, artist.artworks, m.artistProfile.statArtworks)}
                        </span>
                      </span>
                    </TrackedLink>
                  </li>
                ))}
                {results.map((entry, resultIndex) => {
                  const index = artists.length + resultIndex
                  return (
                  <li key={entry.slug} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                    <ObraLink
                      obra={toSummary(entry)}
                      tabIndex={-1}
                      onPointerEnter={() => setActive(index)}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-12 flex-col justify-center px-5 py-2 ${index === active ? 'bg-collage-blue/10' : ''}`}
                    >
                      <span className="font-semibold text-ink">{entry.title ?? m.common.untitled}</span>
                      <span className="text-sm text-muted-foreground">
                        <span aria-hidden>{countryCodeToFlag(entry.countryCode)}</span> {entry.name} · {countryCodeToName(entry.countryCode, locale)}
                      </span>
                    </ObraLink>
                  </li>
                  )
                })}
              </ul>
              {matches.length > results.length && (
                <button
                  type="button"
                  onClick={() => setVisible((current) => current + RESULTS_PAGE)}
                  className="min-h-12 w-full border-t-2 border-ink/10 px-5 text-sm font-semibold text-collage-blue hover:bg-collage-blue/10"
                >
                  {fmt(m.search.more, { count: matches.length - results.length })}
                </button>
              )}
            </>
          ) : (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              {status === 'error' ? m.search.error
                : typed && status !== 'ready' ? m.search.loading
                : typed ? fmt(m.search.noResults, { query: query.trim() })
                : m.search.hint}
            </p>
          )}

          {!signedIn && (
            <div className="flex flex-col gap-3 border-t-2 border-ink/10 bg-collage-yellow/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink">
                <span className="font-bold">{m.search.signUpTitle}</span> {m.search.signUpBody}
              </p>
              <div className="shrink-0">
                <GoogleSignInButton next="/onboarding" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
