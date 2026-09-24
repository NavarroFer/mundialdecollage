'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { countryCodeToFlag, countryCodeToName, type Participant } from '@/lib/participants'
import { InstagramIconLink } from '@/components/instagram-icon-link'

function chipClass(active: boolean) {
  return cn(
    'rounded-full border-2 px-4 py-2 text-xs font-semibold tracking-wide uppercase transition-colors',
    active
      ? 'border-collage-blue bg-collage-blue text-primary-foreground'
      : 'border-ink/10 bg-card text-ink hover:border-ink/30',
  )
}

export function ParticipantsDirectory({ participants }: { participants: Participant[] }) {
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [techniqueFilter, setTechniqueFilter] = useState<string | null>(null)

  const countries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of participants) {
      counts.set(p.countryCode, (counts.get(p.countryCode) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([countryCode, count]) => ({ countryCode, count }))
      .sort((a, b) => countryCodeToName(a.countryCode).localeCompare(countryCodeToName(b.countryCode)))
  }, [participants])

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
        placeholder="Buscar por nombre..."
        aria-label="Buscar participante por nombre"
        className="w-full rounded-full border-2 border-ink/10 bg-card px-5 py-3 text-sm text-ink placeholder:text-muted-foreground focus:border-collage-blue focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCountryFilter(null)} className={chipClass(countryFilter === null)}>
          Todos los países ({participants.length})
        </button>
        {countries.map(({ countryCode, count }) => (
          <button
            key={countryCode}
            type="button"
            onClick={() => setCountryFilter(countryCode)}
            className={chipClass(countryFilter === countryCode)}
          >
            {countryCodeToFlag(countryCode)} {countryCodeToName(countryCode)} — {count}
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
            Todas las técnicas
          </button>
          {techniques.map(({ technique, count }) => (
            <button
              key={technique}
              type="button"
              onClick={() => setTechniqueFilter(technique)}
              className={chipClass(techniqueFilter === technique)}
            >
              {technique} — {count}
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {filtered.map((p, i) => (
            <li
              key={`${p.name}-${p.countryCode}-${i}`}
              className="flex items-center gap-2 rounded-full border-2 border-ink/10 bg-card px-4 py-2 text-sm font-medium text-ink"
            >
              <span aria-hidden>{countryCodeToFlag(p.countryCode)}</span>
              {p.name}
              <span className="text-muted-foreground">· {countryCodeToName(p.countryCode)}</span>
              {p.instagram && <InstagramIconLink href={p.instagram} name={p.name} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-muted-foreground">
          No encontramos participantes con esos filtros.
        </p>
      )}
    </div>
  )
}
