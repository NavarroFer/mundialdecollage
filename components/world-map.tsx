'use client'

import { useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { GeoJsonObject } from 'geojson'
import { X } from 'lucide-react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { ObrasCollage } from '@/components/obras-collage'
import type { Finalist } from '@/lib/finalists'
import rawWorldTopology from '@/lib/data/world-countries-110m.json'
import { isoNumericToAlpha2 } from '@/lib/iso-numeric-country-codes'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'
import { useI18n } from '@/lib/i18n/client'
import { fmt, plural } from '@/lib/i18n/format'

// world-atlas ships this as a TopoJSON Topology, which react-simple-maps
// handles at runtime (it converts to GeoJSON via topojson-client), but its
// types only describe the GeoJSON shapes it accepts as input.
const worldTopology = rawWorldTopology as unknown as GeoJsonObject

type CountryCount = { countryCode: string; count: number }

type Tooltip = { countryCode: string; count: number; x: number; y: number }

export function WorldMap({ breakdown, artworks }: { breakdown: CountryCount[]; artworks: Finalist[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null)
  const { locale, m } = useI18n()
  const countryName = (code: string) => countryCodeToName(code, locale)

  const countsByCode = new Map(breakdown.map((b) => [b.countryCode, b.count]))
  const maxCount = breakdown.reduce((max, b) => Math.max(max, b.count), 1)
  const selectedArtworks = selectedCountryCode
    ? artworks.filter((artwork) => artwork.countryCode.toUpperCase() === selectedCountryCode)
    : []

  const artworkCountries = new Set(artworks.map((artwork) => artwork.countryCode.toUpperCase()))

  function showTooltip(evt: ReactMouseEvent, countryCode: string, count: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ countryCode, count, x: evt.clientX - rect.left, y: evt.clientY - rect.top })
  }

  function selectCountry(countryCode: string) {
    if (!artworkCountries.has(countryCode)) return
    setSelectedCountryCode(countryCode)
    setTooltip(null)
  }

  function handleCountryKeyDown(evt: KeyboardEvent, countryCode: string) {
    if (evt.key !== 'Enter' && evt.key !== ' ') return
    evt.preventDefault()
    selectCountry(countryCode)
  }

  return (
    <div ref={containerRef} className="relative">
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 148 }}
        width={800}
        height={420}
        className="h-auto w-full"
      >
        <Geographies geography={worldTopology}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const code = isoNumericToAlpha2[String(geo.id)]
              const count = code ? countsByCode.get(code) : undefined
              const opacity = count ? 0.35 + 0.65 * (count / maxCount) : 1
              const hasArtworks = code ? artworkCountries.has(code) : false
              const isSelected = code === selectedCountryCode

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseMove={(evt) => code && count && showTooltip(evt, code, count)}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => code && selectCountry(code)}
                  onKeyDown={(evt) => code && handleCountryKeyDown(evt, code)}
                  tabIndex={hasArtworks ? 0 : -1}
                  role={hasArtworks ? 'button' : undefined}
                  aria-label={hasArtworks && code ? fmt(m.map.viewCountry, { country: countryName(code) }) : undefined}
                  aria-pressed={hasArtworks ? isSelected : undefined}
                  className="outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:opacity-60"
                  style={{
                    fill: isSelected ? 'var(--collage-red)' : count ? 'var(--collage-blue)' : 'var(--muted)',
                    fillOpacity: opacity,
                    stroke: 'var(--card)',
                    strokeWidth: isSelected ? 1.75 : 0.75,
                    cursor: hasArtworks ? 'pointer' : 'default',
                  }}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border-2 border-ink bg-card px-3 py-1.5 text-sm font-medium whitespace-nowrap text-ink shadow-md"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
        >
          <span className="mr-1" aria-hidden>
            {countryCodeToFlag(tooltip.countryCode)}
          </span>
          {countryName(tooltip.countryCode)} · {tooltip.count}
        </div>
      )}

      {selectedCountryCode && (
        <div
          className="mt-8 border-t-2 border-ink/10 pt-8"
          role="region"
          aria-labelledby={`country-artworks-${selectedCountryCode}`}
        >
          <p className="sr-only" role="status">
            {plural(locale, selectedArtworks.length, m.map.shown, { country: countryName(selectedCountryCode) })}
          </p>
          <div className="flex items-start justify-between gap-4 px-2 sm:px-5">
            <div>
              <p className="text-sm font-bold tracking-[0.2em] text-collage-red uppercase">
                {countryCodeToFlag(selectedCountryCode)} {countryName(selectedCountryCode)}
              </p>
              <h3
                id={`country-artworks-${selectedCountryCode}`}
                className="font-display mt-2 text-3xl uppercase text-ink sm:text-4xl"
              >
                {plural(locale, selectedArtworks.length, m.map.artworks)}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCountryCode(null)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border-2 border-ink/15 bg-background text-ink transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue"
              aria-label={m.map.close}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {selectedArtworks.length > 0 ? (
            <ObrasCollage
              key={selectedCountryCode}
              finalists={selectedArtworks}
              animateEntrance
              showHint={false}
              ariaLabel={fmt(m.map.countryArtworks, { country: countryName(selectedCountryCode) })}
            />
          ) : (
            <p className="mt-6 text-muted-foreground">{m.map.none}</p>
          )}
        </div>
      )}
    </div>
  )
}
