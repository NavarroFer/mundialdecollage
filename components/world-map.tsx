'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { Feature, GeoJsonObject, MultiPolygon, Position } from 'geojson'
import { Expand, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { ObrasCollage } from '@/components/obras-collage'
import type { ArtworkSummary } from '@/lib/finalists'
import rawWorldTopology from '@/lib/data/world-countries-110m.json'
import rawMalvinas from '@/lib/data/malvinas-50m.json'
import { COUNTRY_MARKER_COORDINATES } from '@/lib/country-codes'
import { alpha2ForUnnumberedShape, isoNumericToAlpha2 } from '@/lib/iso-numeric-country-codes'
import { countryCodeToName } from '@/lib/participants'
import { CountryFlag } from '@/components/country-flag'
import { useI18n } from '@/lib/i18n/client'
import { fmt, plural } from '@/lib/i18n/format'
import { countryFromMapHash, MAP_COUNTRY_EVENT, scrollToMap } from '@/lib/map-country-link'
import { countryPage } from '@/lib/country-pages'
import { MapPager } from '@/components/map-pager'
import { StampConfetti } from '@/components/stamp-confetti'
import { announceStampUnlocked } from '@/lib/stamps'

// The full explorer is loaded only when a visitor explicitly opens it, so the
// summary map remains the only map-related code needed for the initial view.
const MapExplorer = dynamic(() => import('@/components/map-explorer').then((m) => m.MapExplorer), { ssr: false })

// world-atlas ships this as a TopoJSON Topology, which react-simple-maps
// handles at runtime (it converts to GeoJSON via topojson-client), but its
// types only describe the GeoJSON shapes it accepts as input.
const worldTopology = rawWorldTopology as unknown as GeoJsonObject

// The 110m map draws the Malvinas as one small blob. They come instead from
// world-atlas's 50m map (Gran Malvina, Soledad and the islets), drawn larger
// than life around their center so both islands read at this scale.
const MALVINAS_CENTER: Position = [-59.47, -51.79]
const MALVINAS_ZOOM = 2.5
const malvinas50m = rawMalvinas as unknown as Feature<MultiPolygon>
const malvinas: Feature<MultiPolygon> = {
  ...malvinas50m,
  geometry: {
    type: 'MultiPolygon',
    coordinates: malvinas50m.geometry.coordinates.map((polygon) =>
      polygon.map((ring) =>
        ring.map(([lon, lat]) => [
          MALVINAS_CENTER[0] + (lon - MALVINAS_CENTER[0]) * MALVINAS_ZOOM,
          MALVINAS_CENTER[1] + (lat - MALVINAS_CENTER[1]) * MALVINAS_ZOOM,
        ]),
      ),
    ),
  },
}

type CountryCount = { countryCode: string; count: number }

type Tooltip = { countryCode: string; count: number; x: number; y: number }

export function WorldMap({
  breakdown,
  artworks,
  flags,
}: {
  breakdown: CountryCount[]
  artworks: ArtworkSummary[]
  // SVG flags by upper-case country code, from lib/flag-svg.ts.
  flags: Record<string, string>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapCanvasRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [celebrateStamp, setCelebrateStamp] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(false)
  // Arriving on a #mapa-AR link (the flag ribbon, or a shared URL) opens
  // that country right away. Client-only component (ssr: false), so window
  // is always there.
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(() => {
    const code = countryFromMapHash(window.location.hash)
    return code && artworks.some((artwork) => artwork.countryCode.toUpperCase() === code) ? code : null
  })
  // The open country's obras, a page at a time (see lib/country-pages.ts).
  const [page, setPage] = useState(0)
  const regionRef = useRef<HTMLDivElement>(null)
  const { locale, m } = useI18n()
  const countryName = (code: string) => countryCodeToName(code, locale)

  const countsByCode = new Map(breakdown.map((b) => [b.countryCode, b.count]))
  const maxCount = breakdown.reduce((max, b) => Math.max(max, b.count), 1)
  const shownPage = selectedCountryCode ? countryPage(artworks, selectedCountryCode, page) : null
  const shownArtworks = shownPage?.items ?? []

  const artworkCountries = new Set(artworks.map((artwork) => artwork.countryCode.toUpperCase()))

  function showTooltip(evt: ReactMouseEvent, countryCode: string, count: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ countryCode, count, x: evt.clientX - rect.left, y: evt.clientY - rect.top })
  }

  function selectCountry(countryCode: string) {
    if (!artworkCountries.has(countryCode)) return
    void fetch('/api/stamps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stamp: 'world' }) })
      .then((response) => response.ok ? response.json() as Promise<{ awarded: boolean }> : null)
      .then((data) => {
        if (!data) return
        announceStampUnlocked('world', data.awarded)
        if (data.awarded) { setCelebrateStamp(true); window.setTimeout(() => setCelebrateStamp(false), 2200) }
      })
    setSelectedCountryCode(countryCode)
    setPage(0)
    setTooltip(null)
  }

  function changePage(next: number) {
    setPage(next)
    // The pager under the collage leaves the visitor at its bottom; the new
    // page starts from the top of the country's obras.
    const region = regionRef.current
    if (region && region.getBoundingClientRect().top < 0) region.scrollIntoView({ block: 'start' })
  }

  // The browser can't scroll to #mapa-AR on its own (no element has that
  // id), so a country opened from the URL brings the map into view here.
  const openedFromHash = useRef(selectedCountryCode !== null)
  useEffect(() => {
    if (openedFromHash.current) scrollToMap()
  }, [])

  // A ribbon flag tapped while the map is already mounted.
  useEffect(() => {
    const codes = new Set(artworks.map((artwork) => artwork.countryCode.toUpperCase()))
    const onCountry = (event: Event) => {
      const code = (event as CustomEvent<string>).detail
      if (!codes.has(code)) return
      setSelectedCountryCode(code)
      setPage(0)
      setTooltip(null)
    }
    window.addEventListener(MAP_COUNTRY_EVENT, onCountry)
    return () => window.removeEventListener(MAP_COUNTRY_EVENT, onCountry)
  }, [artworks])

  // A quiet scroll-driven camera move using the map that is already on the
  // page. It intentionally never changes map controls or country hit areas.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame: number | undefined
    const update = () => {
      frame = undefined
      const container = containerRef.current
      const canvas = mapCanvasRef.current
      if (!container || !canvas) return
      const rect = container.getBoundingClientRect()
      const viewport = window.innerHeight
      const progress = Math.max(0, Math.min(1, (viewport * 0.86 - rect.top) / (rect.height + viewport * 0.14)))
      const x = (1 - progress) * -10
      const y = (1 - progress) * 18
      const scale = 0.965 + progress * 0.035
      canvas.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
    }
    const onScroll = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [])

  function closeCountry() {
    setSelectedCountryCode(null)
    // Drop a #mapa-AR from the URL, so a reload doesn't reopen what was closed.
    if (countryFromMapHash(window.location.hash)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  function handleCountryKeyDown(evt: KeyboardEvent, countryCode: string) {
    if (evt.key !== 'Enter' && evt.key !== ' ') return
    evt.preventDefault()
    selectCountry(countryCode)
  }

  // Shapes and dots behave identically: hover tooltip, click/Enter to open the
  // country's obras, focusable only when there's something to open.
  function countryInteraction(code: string | undefined) {
    const count = code ? countsByCode.get(code) : undefined
    const hasArtworks = code ? artworkCountries.has(code) : false
    return {
      onMouseMove: (evt: ReactMouseEvent) => code && count && showTooltip(evt, code, count),
      onMouseLeave: () => setTooltip(null),
      onClick: () => code && selectCountry(code),
      onKeyDown: (evt: KeyboardEvent) => code && handleCountryKeyDown(evt, code),
      tabIndex: hasArtworks ? 0 : -1,
      role: hasArtworks ? 'button' : undefined,
      'aria-label': hasArtworks && code ? fmt(m.map.viewCountry, { country: countryName(code) }) : undefined,
      'aria-pressed': hasArtworks ? code === selectedCountryCode : undefined,
    }
  }

  // Countries too small for the 110m map (Malta, Singapore, Caribbean
  // islands…) get a dot, but only once they have obras or artists to show.
  const markerCodes = [...new Set([...countsByCode.keys(), ...artworkCountries])].filter(
    (code) => code in COUNTRY_MARKER_COORDINATES,
  )

  return (
    <div ref={containerRef} className="relative">
      <StampConfetti visible={celebrateStamp} />
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setExplorerOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-card px-4 py-2 text-sm font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:bg-collage-yellow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue"
        >
          <Expand className="size-4" aria-hidden />
          {m.map.openExplorer}
        </button>
      </div>
      <div ref={mapCanvasRef} className="origin-center will-change-transform motion-reduce:transform-none">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 148 }}
          width={800}
          height={420}
          className="h-auto w-full"
        >
        <Geographies geography={worldTopology}>
          {({ geographies, path }) =>
            geographies.map((shape) => {
              const geo = String(shape.id) === '238' ? { ...malvinas, rsmKey: shape.rsmKey, svgPath: path(malvinas) } : shape
              const code =
                isoNumericToAlpha2[String(geo.id)] ?? alpha2ForUnnumberedShape[String(geo.properties?.name)]
              const count = code ? countsByCode.get(code) : undefined
              // Countries without published obras intentionally recede so the
              // participating countries and their relative volume stand out.
              const opacity = count ? 0.35 + 0.65 * (count / maxCount) : 0.38
              const hasArtworks = code ? artworkCountries.has(code) : false
              const isSelected = code === selectedCountryCode
              const fill = isSelected ? 'var(--collage-red)' : count ? 'var(--collage-blue)' : 'var(--muted)'
              const fillOpacity = isSelected ? 1 : opacity
              // No white border on the Malvinas: at a few pixels it would eat
              // the islands and close the strait between them.
              const isMalvinas = String(geo.id) === '238'

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  {...countryInteraction(code)}
                  className="outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:opacity-60"
                  style={{
                    fill,
                    fillOpacity,
                    stroke: isMalvinas ? 'none' : 'var(--card)',
                    strokeWidth: isSelected ? 1.75 : 0.75,
                    cursor: hasArtworks ? 'pointer' : 'default',
                  }}
                />
              )
            })
          }
        </Geographies>

        {markerCodes.map((code) => {
          const count = countsByCode.get(code)
          const isSelected = code === selectedCountryCode

          return (
            <Marker
              key={code}
              coordinates={COUNTRY_MARKER_COORDINATES[code]}
              {...countryInteraction(code)}
              className="outline-none transition-opacity duration-150 hover:opacity-80 focus-visible:opacity-60"
              style={{ cursor: artworkCountries.has(code) ? 'pointer' : 'default' }}
            >
              {/* A generous invisible hit area: the visible dot alone is a
                  couple of pixels wide once the map shrinks to phone width. */}
              <circle r={16} fill="transparent" />
              <circle
                r={isSelected ? 5.5 : 4.5}
                style={{
                  fill: isSelected ? 'var(--collage-red)' : 'var(--collage-blue)',
                  fillOpacity: isSelected ? 1 : count ? 0.55 + 0.45 * (count / maxCount) : 0.55,
                  stroke: 'var(--card)',
                  strokeWidth: 1.5,
                }}
              />
            </Marker>
          )
        })}
        </ComposableMap>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border-2 border-ink bg-card px-3 py-1.5 text-sm font-medium whitespace-nowrap text-ink shadow-md"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
        >
          <span className="mr-1" aria-hidden>
            <CountryFlag countryCode={tooltip.countryCode} svg={flags[tooltip.countryCode.toUpperCase()]} />
          </span>
          {countryName(tooltip.countryCode)} · {plural(locale, tooltip.count, m.map.artworks)}
        </div>
      )}

      {selectedCountryCode && shownPage && (
        <div
          ref={regionRef}
          className="mt-8 border-t-2 border-ink/10 pt-8"
          role="region"
          aria-labelledby={`country-artworks-${selectedCountryCode}`}
        >
          <p className="sr-only" role="status">
            {plural(locale, shownArtworks.length, m.map.shown, { country: countryName(selectedCountryCode) })}
          </p>
          <div className="flex items-start justify-between gap-4 px-2 sm:px-5">
            <div>
              <p className="text-sm font-bold tracking-[0.2em] text-collage-red uppercase">
                <CountryFlag countryCode={selectedCountryCode} svg={flags[selectedCountryCode.toUpperCase()]} /> {countryName(selectedCountryCode)}
              </p>
              <h3
                id={`country-artworks-${selectedCountryCode}`}
                className="font-display mt-2 text-3xl uppercase text-ink sm:text-4xl"
              >
                {plural(locale, shownPage.total, m.map.artworks)}
              </h3>
              <MapPager page={shownPage} onPageChange={changePage} className="mt-2 -ml-2" />
            </div>
            <button
              type="button"
              onClick={closeCountry}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border-2 border-ink/15 bg-background text-ink transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue"
              aria-label={m.map.close}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {shownArtworks.length > 0 ? (
            <>
              <ObrasCollage
                key={`${selectedCountryCode}-${shownPage.page}`}
                finalists={shownArtworks}
                flags={flags}
                animateEntrance
                showHint={false}
                ariaLabel={fmt(m.map.countryArtworks, { country: countryName(selectedCountryCode) })}
              />
              <MapPager page={shownPage} onPageChange={changePage} className="justify-center" />
            </>
          ) : (
            <p className="mt-6 text-muted-foreground">{m.map.none}</p>
          )}
        </div>
      )}
      {explorerOpen && (
        <MapExplorer
          open={explorerOpen}
          onOpenChange={setExplorerOpen}
          breakdown={breakdown}
          artworks={artworks}
          flags={flags}
          initialCountryCode={selectedCountryCode}
          initialPage={shownPage?.page ?? 0}
        />
      )}
    </div>
  )
}
