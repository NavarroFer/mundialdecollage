'use client'

import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { GeoJsonObject } from 'geojson'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import rawWorldTopology from '@/lib/data/world-countries-110m.json'
import { isoNumericToAlpha2 } from '@/lib/iso-numeric-country-codes'
import { countryCodeToFlag, countryCodeToName } from '@/lib/participants'

// world-atlas ships this as a TopoJSON Topology, which react-simple-maps
// handles at runtime (it converts to GeoJSON via topojson-client), but its
// types only describe the GeoJSON shapes it accepts as input.
const worldTopology = rawWorldTopology as unknown as GeoJsonObject

type CountryCount = { countryCode: string; count: number }

type Tooltip = { countryCode: string; count: number; x: number; y: number }

export function WorldMap({ breakdown }: { breakdown: CountryCount[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const countsByCode = new Map(breakdown.map((b) => [b.countryCode, b.count]))
  const maxCount = breakdown.reduce((max, b) => Math.max(max, b.count), 1)

  function showTooltip(evt: ReactMouseEvent, countryCode: string, count: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ countryCode, count, x: evt.clientX - rect.left, y: evt.clientY - rect.top })
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

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseMove={(evt) => code && count && showTooltip(evt, code, count)}
                  onMouseLeave={() => setTooltip(null)}
                  className="outline-none transition-opacity duration-150 hover:opacity-80"
                  style={{
                    fill: count ? 'var(--collage-blue)' : 'var(--muted)',
                    fillOpacity: opacity,
                    stroke: 'var(--card)',
                    strokeWidth: 0.75,
                    cursor: count ? 'pointer' : 'default',
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
          {countryCodeToName(tooltip.countryCode)} · {tooltip.count}
        </div>
      )}
    </div>
  )
}
