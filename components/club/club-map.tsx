'use client'

import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import { Minus, Move, Plus, RotateCcw, X } from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup, useMapContext, useZoomPanContext } from 'react-simple-maps'
import { worldTopology } from '@/lib/world-shapes'
import type { ClubHouse } from '@/lib/club-map'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'

const WIDTH = 800
const HEIGHT = 420
const INITIAL_CENTER: [number, number] = [0, 15]
const MAX_ZOOM = 24

export type ClubMapTexts = {
  /** Label of the button that opens a house's gallery. */
  enter: string
  hint: string
  close: string
  /** Pick mode only: the label of the member's own pin. */
  yourHouse?: string
}

// The Club's world map, zoomable with the wheel, a pinch or the buttons.
// To browse, each house opens a card with the artist, their obras and the
// way into their gallery. To pick (the editor), a click anywhere sets the
// member's own house.
export function ClubMap({ houses, texts, picked, onPick, onEnter, initialCenter, initialZoom }: {
  houses: ClubHouse[]
  texts: ClubMapTexts
  /** Inside a gallery: how to go to another one (a full page load); a link otherwise. */
  onEnter?: (slug: string) => void
  picked?: [number, number] | null
  onPick?: (coordinates: [number, number]) => void
  initialCenter?: [number, number]
  initialZoom?: number
}) {
  const { locale, m } = useI18n()
  const start = { center: initialCenter ?? INITIAL_CENTER, zoom: initialZoom ?? 1 }
  const [center, setCenter] = useState<[number, number]>(start.center)
  const [zoom, setZoom] = useState(start.zoom)
  const [selected, setSelected] = useState<ClubHouse | null>(null)

  return (
    <div className="relative">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-ink/10 bg-[linear-gradient(135deg,var(--paper),color-mix(in_srgb,var(--collage-blue)_8%,var(--paper)))] sm:aspect-[40/21]">
        {/* Slice, not meet: on a phone the map fills the taller box and is panned sideways. */}
        <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 148 }} width={WIDTH} height={HEIGHT} preserveAspectRatio="xMidYMid slice" className="h-full w-full touch-none select-none" style={{ overflow: 'hidden' }}>
          <ZoomableGroup
            center={center}
            zoom={zoom}
            minZoom={1}
            maxZoom={MAX_ZOOM}
            onMoveEnd={({ coordinates, zoom: nextZoom }) => {
              if (coordinates) setCenter([coordinates[0], coordinates[1]])
              if (typeof nextZoom === 'number') setZoom(nextZoom)
            }}
          >
            <MapSurface onPick={onPick}>
              <Geographies geography={worldTopology}>
                {({ geographies }) => geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    className="outline-none"
                    style={{ fill: 'var(--muted)', stroke: 'var(--paper)', strokeWidth: 0.5 / zoom, cursor: onPick ? 'crosshair' : 'grab' }}
                  />
                ))}
              </Geographies>
            </MapSurface>
            {houses.flatMap((house) => (house.coordinates ? [house as ClubHouse & { coordinates: [number, number] }] : [])).map((house) => (
              <HouseMarker
                key={house.slug}
                house={house}
                selected={selected?.slug === house.slug}
                onSelect={onPick ? undefined : () => setSelected(house)}
                label={`${house.artistName} · ${plural(locale, house.obras, m.map.artworks)}`}
              />
            ))}
            {picked && <HouseMarker own label={texts.yourHouse ?? ''} house={{ slug: 'own', title: '', artistName: '', countryCode: null, coordinates: picked, obras: 0 }} />}
          </ZoomableGroup>
        </ComposableMap>

        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <button type="button" onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value * 1.8))} className="map-explorer-control" aria-label={m.map.zoomIn}><Plus className="size-5" aria-hidden /></button>
          <button type="button" onClick={() => setZoom((value) => Math.max(1, value / 1.8))} className="map-explorer-control" aria-label={m.map.zoomOut}><Minus className="size-5" aria-hidden /></button>
          <button type="button" onClick={() => { setCenter(start.center); setZoom(start.zoom) }} className="map-explorer-control" aria-label={m.map.resetView}><RotateCcw className="size-4" aria-hidden /></button>
        </div>
        <p className="pointer-events-none absolute right-3 bottom-3 hidden items-center gap-2 rounded-full bg-paper/90 px-3 py-2 text-xs font-semibold text-ink shadow-sm sm:flex">
          <Move className="size-3.5" aria-hidden /> {texts.hint}
        </p>
      </div>

      {/* Under the map on a phone, so it never covers it; over its top right corner on wider screens. */}
      {selected && (
        <div role="dialog" aria-label={selected.artistName} className="relative z-10 mt-3 rounded-xl border-2 border-ink bg-card p-4 shadow-[3px_3px_0_var(--color-ink)] sm:absolute sm:top-3 sm:right-3 sm:mt-0 sm:w-80">
          <button type="button" onClick={() => setSelected(null)} aria-label={texts.close} className="absolute top-2 right-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:text-ink">
            <X className="size-4" aria-hidden />
          </button>
          <p className="pr-10 font-display text-xl leading-tight uppercase">{selected.artistName}</p>
          {selected.title !== selected.artistName && <p className="pr-10 text-sm text-muted-foreground">{selected.title}</p>}
          <p className="mt-1 text-sm font-semibold text-ink">{plural(locale, selected.obras, m.map.artworks)}</p>
          {onEnter ? (
            <button type="button" onClick={() => onEnter(selected.slug)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white">
              {texts.enter}
            </button>
          ) : (
            <Link href={`/club/${selected.slug}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white">
              {texts.enter}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// Catches clicks on land and sea alike. Inside the zoomed group, so the
// inverse of its screen matrix takes a click back to unzoomed map units,
// which the projection turns into a place. d3-zoom swallows the click that
// ends a drag, so panning never moves the house.
function MapSurface({ onPick, children }: { onPick?: (coordinates: [number, number]) => void; children: React.ReactNode }) {
  const { projection } = useMapContext()
  function pick(event: ReactMouseEvent<SVGGElement>) {
    const matrix = event.currentTarget.getScreenCTM()
    if (!onPick || !matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const place = projection.invert?.([point.x, point.y])
    if (place && Number.isFinite(place[0]) && Number.isFinite(place[1])) onPick([place[0], place[1]])
  }
  return (
    <g onClick={pick}>
      {onPick && <rect width={WIDTH} height={HEIGHT} fill="transparent" style={{ cursor: "crosshair" }} />}
      {children}
    </g>
  )
}

// A little house that keeps its size on screen however far the map zooms.
function HouseMarker({ house, label, selected, own, onSelect }: { house: ClubHouse & { coordinates: [number, number] }; label: string; selected?: boolean; own?: boolean; onSelect?: () => void }) {
  const { k } = useZoomPanContext()
  const fill = own || selected ? 'var(--collage-red)' : 'var(--collage-blue)'
  return (
    <Marker
      coordinates={house.coordinates}
      onClick={onSelect}
      onKeyDown={(event) => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect() } }}
      tabIndex={onSelect ? 0 : -1}
      role={onSelect ? 'button' : 'img'}
      aria-label={label}
      className="outline-none focus-visible:opacity-70"
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
    >
      <g transform={`scale(${1 / k})`}>
        <title>{label}</title>
        <circle r={16} fill="transparent" />
        <path d="M0 -13 L11 -3 L8 -3 L8 7 L-8 7 L-8 -3 L-11 -3 Z" fill={fill} stroke="var(--paper)" strokeWidth={1.5} strokeLinejoin="round" />
        <rect x={-2.5} y={1} width={5} height={6} fill="var(--paper)" />
      </g>
    </Marker>
  )
}
