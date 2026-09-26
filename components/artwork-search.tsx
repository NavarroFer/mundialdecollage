'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { searchArtworks, type SearchEntry } from '@/lib/artwork-search'
import { useI18n } from '@/lib/i18n/client'
import { fmt, plural } from '@/lib/i18n/format'

type Status = 'idle' | 'loading' | 'ready' | 'error'

// One request per visit, started as soon as the visitor reaches for the
// search (hover, touch or focus), so the list is usually here before the
// first letter is typed.
let pending: Promise<SearchEntry[]> | null = null
function loadEntries() {
  pending ??= fetch('/api/obras')
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status))
      return response.json() as Promise<SearchEntry[]>
    })
    .catch((error) => {
      pending = null
      throw error
    })
  return pending
}

// Homepage search over every published obra. Opening it also invites
// signed-out artists to sign up and see their own obra.
export function ArtworkSearch({ signedIn }: { signedIn: boolean }) {
  const { locale, m } = useI18n()
  const router = useRouter()
  const [entries, setEntries] = useState<SearchEntry[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  function prepare() {
    if (status === 'loading' || status === 'ready') return
    setStatus('loading')
    loadEntries().then(
      (list) => { setEntries(list); setStatus('ready') },
      () => setStatus('error'),
    )
  }

  const results = useMemo(
    () => searchArtworks(entries, query, (code) => countryCodeToName(code, locale)),
    [entries, query, locale],
  )

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
    if (!results.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      const chosen = results[Math.max(active, 0)]
      if (chosen) router.push(`/obras/${chosen.slug}`)
    }
  }

  const typed = query.trim().length > 0
  const showList = typed && status === 'ready' && results.length > 0

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-xl text-left" onPointerEnter={prepare}>
      <div role="search" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-ink/60" aria-hidden="true" />
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
          onChange={(event) => { setQuery(event.target.value); setActive(-1); setOpen(true) }}
          onKeyDown={onKeyDown}
          className="h-14 w-full rounded-full border-2 border-ink bg-card pr-12 pl-13 text-base text-ink shadow-[4px_4px_0_0] shadow-ink placeholder:text-muted-foreground focus:border-collage-blue focus:shadow-collage-blue focus:outline-none sm:h-16 sm:text-lg [&::-webkit-search-cancel-button]:hidden"
        />
        {typed && (
          <button
            type="button"
            onClick={() => { setQuery(''); setActive(-1) }}
            className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ink/60 hover:text-ink"
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">{m.search.clear}</span>
          </button>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {typed && status === 'ready' ? plural(locale, results.length, m.search.results) : ''}
      </p>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-3 overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-[6px_6px_0_0] shadow-ink">
          {showList ? (
            <ul id={listId} role="listbox" aria-label={m.search.label} className="max-h-[50vh] overflow-y-auto py-2">
              {results.map((entry, index) => (
                <li key={entry.slug} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                  <a
                    href={`/obras/${entry.slug}`}
                    tabIndex={-1}
                    onPointerEnter={() => setActive(index)}
                    className={`flex min-h-12 flex-col justify-center px-5 py-2 ${index === active ? 'bg-collage-blue/10' : ''}`}
                  >
                    <span className="font-semibold text-ink">{entry.title ?? m.common.noData}</span>
                    <span className="text-sm text-muted-foreground">
                      <span aria-hidden>{countryCodeToFlag(entry.countryCode)}</span> {entry.name} · {countryCodeToName(entry.countryCode, locale)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
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
