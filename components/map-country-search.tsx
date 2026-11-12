'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { CountryFlag } from '@/components/country-flag'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'
import { searchCountries } from '@/lib/map-country-search'
import { countryCodeToName } from '@/lib/participants'
import { cn } from '@/lib/utils'

// A combobox over the countries that have obras: type a few letters, pick one
// and the map opens it, the same as tapping it on the map itself.
export function MapCountrySearch({
  codes,
  counts,
  flags,
  selectedCode,
  onSelect,
  className,
}: {
  // Upper-case codes of the countries that can be opened.
  codes: string[]
  counts: Map<string, number>
  flags: Record<string, string>
  selectedCode: string | null
  onSelect: (code: string) => void
  className?: string
}) {
  const { locale, m } = useI18n()
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const countries = useMemo(
    () =>
      codes
        .map((code) => ({ code, name: countryCodeToName(code, locale) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [codes, locale],
  )
  const results = useMemo(() => searchCountries(countries, query), [countries, query])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function choose(code: string) {
    onSelect(code)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) { setOpen(true); return }
      if (results.length === 0) return
      setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length)
    } else if (event.key === 'Enter') {
      const pick = results[Math.min(active, results.length - 1)]
      if (open && pick) { event.preventDefault(); choose(pick.code) }
    } else if (event.key === 'Escape') {
      if (open) { event.stopPropagation(); setOpen(false) }
    }
  }

  const activeId = open && results.length > 0 ? `${listId}-${Math.min(active, results.length - 1)}` : undefined

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-card px-4 shadow-[3px_3px_0_var(--color-ink)] focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-collage-blue">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label={m.map.searchCountryLabel}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={m.map.searchCountry}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          // 16px keeps iOS from zooming the page when the field is focused.
          className="w-full min-w-0 bg-transparent py-2 text-base font-medium text-ink outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={m.map.searchCountryLabel}
          className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border-2 border-ink bg-card py-1 shadow-md"
        >
          {results.length === 0 && <li role="presentation" className="px-4 py-2.5 text-sm text-muted-foreground">{m.map.searchCountryNone}</li>}
          {results.map((country, index) => (
            <li
              key={country.code}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={country.code === selectedCode}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(country.code)}
              onPointerMove={() => setActive(index)}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 text-sm text-ink',
                index === active && 'bg-muted',
                country.code === selectedCode && 'font-bold text-collage-blue',
              )}
            >
              <span aria-hidden className="shrink-0 text-lg"><CountryFlag countryCode={country.code} svg={flags[country.code]} /></span>
              <span className="min-w-0 flex-1 truncate">{country.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{plural(locale, counts.get(country.code) ?? 0, m.map.artworks)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
