'use client'

import { useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { formatShare } from '@/lib/artwork-stats'
import { formatCount } from '@/lib/chart-math'
import { COUNTRY_MARKER_COORDINATES } from '@/lib/country-codes'
import { countryCodeToName } from '@/lib/participants'
import { isMalvinas, shapeCountryCode, withMalvinas, worldTopology } from '@/lib/world-shapes'

type CountryCount = { countryCode: string; count: number }

/** How deep a country's blue is: by square root, so one big country doesn't wash out the rest. */
export const countryDepth = (count: number, max: number) => (count > 0 && max > 0 ? 0.2 + 0.8 * Math.sqrt(count / max) : 0)

// Where people are, as a heat map on the site's world (Malvinas included):
// the more a country has, the deeper its blue. Pointing at one names it under
// the map; at rest it names the leader. Countries too small for the 110m map
// get a dot once they have someone.
export function CountryMap({ rows, total, unit, label }: {
  rows: CountryCount[]
  total: number
  unit: { one: string; other: string }
  label: string
}) {
  const [pointed, setPointed] = useState<string | null>(null)
  const counts = new Map(rows.map((row) => [row.countryCode, row.count]))
  const max = Math.max(...rows.map((row) => row.count), 1)
  const leader = rows.reduce<CountryCount | null>((best, row) => (!best || row.count > best.count ? row : best), null)
  const named = pointed ? { countryCode: pointed, count: counts.get(pointed) ?? 0 } : leader
  const dots = rows.filter((row) => row.countryCode in COUNTRY_MARKER_COORDINATES)
  const point = (code: string | undefined) => ({
    onMouseEnter: () => { if (code && counts.has(code)) setPointed(code) },
    onMouseLeave: () => setPointed(null),
  })

  return (
    <div>
      <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 148 }} width={800} height={420} className="mx-auto h-auto w-full max-w-4xl" role="img" aria-label={label}>
        <Geographies geography={worldTopology}>
          {({ geographies, path }) =>
            geographies.map((shape) => {
              const geo = withMalvinas(shape, path)
              const code = shapeCountryCode(geo)
              const depth = countryDepth(code ? counts.get(code) ?? 0 : 0, max)
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  {...point(code)}
                  className="outline-none transition-opacity duration-150 hover:opacity-80"
                  style={{
                    fill: depth ? 'var(--collage-blue)' : 'var(--muted)',
                    fillOpacity: depth || 1,
                    stroke: isMalvinas(geo) ? 'none' : 'var(--card)',
                    strokeWidth: code && code === pointed ? 1.75 : 0.6,
                  }}
                />
              )
            })
          }
        </Geographies>
        {dots.map(({ countryCode, count }) => (
          <Marker key={countryCode} coordinates={COUNTRY_MARKER_COORDINATES[countryCode]} {...point(countryCode)}>
            <circle r={12} fill="transparent" />
            <circle r={4.5} style={{ fill: 'var(--collage-blue)', fillOpacity: countryDepth(count, max), stroke: 'var(--card)', strokeWidth: 1.5 }} />
          </Marker>
        ))}
      </ComposableMap>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p aria-live="polite" className="min-w-0 text-sm text-ink">
          {named && (
            <>
              <span className="font-bold">{countryCodeToName(named.countryCode)}</span>
              {' · '}
              {formatCount(named.count)} {named.count === 1 ? unit.one : unit.other}
              <span className="text-muted-foreground"> · {formatShare(named.count, total)}</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden="true">
          <span className="tabular-nums">1</span>
          <span className="h-2 w-28 rounded-full" style={{ background: 'linear-gradient(to right, color-mix(in oklab, var(--collage-blue) 20%, var(--card)), var(--collage-blue))' }} />
          <span className="tabular-nums">{formatCount(max)}</span>
        </div>
      </div>
    </div>
  )
}
