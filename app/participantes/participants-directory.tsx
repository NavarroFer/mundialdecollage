'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { countryCodeToName, type Participant } from '@/lib/participants'
import { CountryFlag } from '@/components/country-flag'
import { InstagramIconLink } from '@/components/instagram-icon-link'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'

function chipClass(active: boolean) {
  return cn(
    'rounded-full border-2 px-4 py-2 text-xs font-semibold tracking-wide uppercase transition-colors',
    active
      ? 'border-collage-blue bg-collage-blue text-primary-foreground'
      : 'border-ink/10 bg-card text-ink hover:border-ink/30',
  )
}

export function ParticipantsDirectory({
  participants,
  flags,
}: {
  participants: Participant[]
  // SVG flags by upper-case country code, from lib/flag-svg.ts.
  flags: Record<string, string>
}) {
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [techniqueFilter, setTechniqueFilter] = useState<string | null>(null)
  const { locale, m } = useI18n()
  const countryName = (code: string) => countryCodeToName(code, locale)
  const techniqueName = (technique: string) => m.common.techniques[technique] ?? technique

  const countries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of participants) {
      counts.set(p.countryCode, (counts.get(p.countryCode) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([countryCode, count]) => ({ countryCode, count }))
      .sort((a, b) => countryName(a.countryCode).localeCompare(countryName(b.countryCode), locale))
    // countryName only changes with locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, locale])

  const techniques = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of participants) {
      if (!p.technique) continue
      counts.set(p.technique, (counts.get(p.technique) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([technique, count]) => ({ technique, count }))
      .sort((a, b) => a.technique.localeCompare(b.technique))
  }, [participants])

  const hasTechniques = techniques.length > 0

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return participants.filter((p) => {
      if (normalizedQuery && !p.name.toLowerCase().includes(normalizedQuery)) return false
      if (countryFilter && p.countryCode !== countryFilter) return false
      if (techniqueFilter && p.technique !== techniqueFilter) return false
      return true
    })
  }, [participants, query, countryFilter, techniqueFilter])

  return (
    <div className="mt-10 space-y-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={m.participantsPage.searchPlaceholder}
        aria-label={m.participantsPage.searchLabel}
        className="w-full rounded-full border-2 border-ink/10 bg-card px-5 py-3 text-sm text-ink placeholder:text-muted-foreground focus:border-collage-blue focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCountryFilter(null)} className={chipClass(countryFilter === null)}>
          {fmt(m.participantsPage.allCountries, { count: participants.length })}
        </button>
        {countries.map(({ countryCode, count }) => (
          <button
            key={countryCode}
            type="button"
            onClick={() => setCountryFilter(countryCode)}
            className={chipClass(countryFilter === countryCode)}
          >
            <CountryFlag countryCode={countryCode} svg={flags[countryCode.toUpperCase()]} /> {countryName(countryCode)} — {count}
          </button>
        ))}
      </div>

      {hasTechniques && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTechniqueFilter(null)}
            className={chipClass(techniqueFilter === null)}
          >
            {m.participantsPage.allTechniques}
          </button>
          {techniques.map(({ technique, count }) => (
            <button
              key={technique}
              type="button"
              onClick={() => setTechniqueFilter(technique)}
              className={chipClass(techniqueFilter === technique)}
            >
              {techniqueName(technique)} — {count}
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {filtered.map((p, i) => (
            <li
              key={`${p.name}-${p.countryCode}-${i}`}
              className="flex max-w-full items-center gap-2 rounded-full border-2 border-ink/10 bg-card px-4 py-2 text-sm font-medium text-ink"
            >
              <CountryFlag countryCode={p.countryCode} svg={flags[p.countryCode.toUpperCase()]} />
              {/* One-word names can be long enough to overflow a phone. */}
              <span className="min-w-0 [overflow-wrap:anywhere]">{p.name}</span>
              <span className="text-muted-foreground">· {countryName(p.countryCode)}</span>
              {p.instagram && <InstagramIconLink href={p.instagram} name={p.name} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-muted-foreground">
          {m.participantsPage.noResults}
        </p>
      )}
    </div>
  )
}
