'use client'

/* Artwork URLs come from the same remote storage as the existing collage stack;
   this compact, scrolling browser should preserve their original framing. */
/* eslint-disable @next/next/no-img-element */

import { ObraLink } from '@/components/obra-modal'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { GeoJsonObject } from 'geojson'
import { Minus, Move, Plus, RotateCcw, X } from 'lucide-react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { CountryFlag } from '@/components/country-flag'
import { MapPager } from '@/components/map-pager'
import type { ArtworkSummary } from '@/lib/finalists'
import rawWorldTopology from '@/lib/data/world-countries-110m.json'
import { COUNTRY_MARKER_COORDINATES } from '@/lib/country-codes'
import { alpha2ForUnnumberedShape, isoNumericToAlpha2 } from '@/lib/iso-numeric-country-codes'
import { countryCodeToName } from '@/lib/participants'
import { useI18n } from '@/lib/i18n/client'
import { fmt, plural } from '@/lib/i18n/format'
import { imageSrc } from '@/lib/image-src'
import { countryPage } from '@/lib/country-pages'

const worldTopology = rawWorldTopology as unknown as GeoJsonObject
const INITIAL_CENTER: [number, number] = [0, 15]
const INITIAL_ZOOM = 1
type CountryCount = { countryCode: string; count: number }

export function MapExplorer({ open, onOpenChange, breakdown, artworks, flags, initialCountryCode, initialPage }: { open: boolean; onOpenChange: (open: boolean) => void; breakdown: CountryCount[]; artworks: ArtworkSummary[]; flags: Record<string, string>; initialCountryCode: string | null; initialPage: number }) {
  const { locale, m } = useI18n()
  const initialCoordinates = initialCountryCode ? COUNTRY_MARKER_COORDINATES[initialCountryCode] : undefined
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(initialCountryCode)
  // Opens on the page the home's map was showing (see lib/country-pages.ts).
  const [page, setPage] = useState(initialPage)
  const asideRef = useRef<HTMLElement>(null)
  const [center, setCenter] = useState<[number, number]>(initialCoordinates ?? INITIAL_CENTER)
  const [zoom, setZoom] = useState(initialCoordinates ? 3.25 : INITIAL_ZOOM)
  const countryName = (code: string) => countryCodeToName(code, locale)
  const countsByCode = useMemo(() => new Map(breakdown.map((item) => [item.countryCode, item.count])), [breakdown])
  const artworkCountries = useMemo(() => new Set(artworks.map((artwork) => artwork.countryCode.toUpperCase())), [artworks])
  const maxCount = useMemo(() => breakdown.reduce((max, item) => Math.max(max, item.count), 1), [breakdown])
  const shownPage = selectedCountryCode ? countryPage(artworks, selectedCountryCode, page) : null
  const markerCodes = useMemo(() => [...new Set([...countsByCode.keys(), ...artworkCountries])].filter((code) => code in COUNTRY_MARKER_COORDINATES), [countsByCode, artworkCountries])

  function selectCountry(countryCode: string) {
    if (!artworkCountries.has(countryCode)) return
    setSelectedCountryCode(countryCode)
    setPage(0)
    const coordinates = COUNTRY_MARKER_COORDINATES[countryCode]
    if (coordinates) { setCenter(coordinates); setZoom(3.25) }
  }
  function countryInteraction(code: string | undefined) {
    const hasArtworks = code ? artworkCountries.has(code) : false
    return {
      onClick: () => code && selectCountry(code),
      onKeyDown: (event: KeyboardEvent) => { if (code && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectCountry(code) } },
      tabIndex: hasArtworks ? 0 : -1,
      role: hasArtworks ? 'button' : undefined,
      'aria-label': hasArtworks && code ? fmt(m.map.viewCountry, { country: countryName(code) }) : undefined,
      'aria-pressed': hasArtworks ? code === selectedCountryCode : undefined,
    }
  }
  function resetView() { setCenter(INITIAL_CENTER); setZoom(INITIAL_ZOOM) }
  function changePage(next: number) { setPage(next); asideRef.current?.scrollTo({ top: 0 }) }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showClose={false} overlayClassName="bg-ink/80" className="h-[100dvh] max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-paper p-0 shadow-none">
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,1fr)_25rem] lg:grid-rows-1">
        <header className="z-10 flex items-center justify-between gap-3 border-b-2 border-ink/10 bg-paper px-4 py-3 sm:px-6 lg:col-span-2">
          <div className="min-w-0"><p className="text-xs font-bold tracking-[0.2em] text-collage-blue uppercase">{m.map.explorerEyebrow}</p><DialogTitle className="font-display truncate text-2xl uppercase sm:text-3xl">{m.map.explorerTitle}</DialogTitle></div>
          <button type="button" onClick={() => onOpenChange(false)} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-card text-ink shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-collage-blue" aria-label={m.map.closeExplorer}><X className="size-5" aria-hidden /></button>
        </header>
        <main className="relative min-h-0 overflow-hidden bg-[radial-gradient(circle_at_25%_20%,color-mix(in_srgb,var(--collage-yellow)_18%,transparent),transparent_34%),linear-gradient(135deg,var(--paper),color-mix(in_srgb,var(--collage-blue)_7%,var(--paper)))]">
          <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 190 }} width={1100} height={720} className="h-full w-full touch-none select-none">
            <ZoomableGroup center={center} zoom={zoom} minZoom={1} maxZoom={8} onMoveEnd={({ coordinates, zoom: nextZoom }) => { if (coordinates) setCenter([coordinates[0], coordinates[1]]); if (typeof nextZoom === 'number') setZoom(nextZoom) }}>
              <Geographies geography={worldTopology}>{({ geographies }) => geographies.map((geo) => {
                const code = isoNumericToAlpha2[String(geo.id)] ?? alpha2ForUnnumberedShape[String(geo.properties?.name)]
                const count = code ? countsByCode.get(code) : undefined
                const hasArtworks = code ? artworkCountries.has(code) : false
                const selected = code === selectedCountryCode
                return <Geography key={geo.rsmKey} geography={geo} {...countryInteraction(code)} className="outline-none transition-[fill,opacity] duration-150 hover:opacity-80 focus-visible:opacity-65" style={{ fill: selected ? 'var(--collage-red)' : count ? 'var(--collage-blue)' : 'var(--muted)', fillOpacity: selected ? 1 : count ? 0.38 + 0.62 * (count / maxCount) : 0.72, stroke: 'var(--paper)', strokeWidth: selected ? 1.65 : 0.6, cursor: hasArtworks ? 'pointer' : 'grab' }} />
              })}</Geographies>
              {markerCodes.map((code) => { const selected = code === selectedCountryCode; const count = countsByCode.get(code); return <Marker key={code} coordinates={COUNTRY_MARKER_COORDINATES[code]} {...countryInteraction(code)} className="outline-none" style={{ cursor: artworkCountries.has(code) ? 'pointer' : 'grab' }}><circle r={18} fill="transparent" /><circle r={selected ? 7 : 5.5} fill={selected ? 'var(--collage-red)' : 'var(--collage-blue)'} fillOpacity={selected ? 1 : count ? 0.65 + 0.35 * (count / maxCount) : 0.65} stroke="var(--paper)" strokeWidth={1.75} /></Marker> })}
            </ZoomableGroup>
          </ComposableMap>
          <div className="absolute bottom-4 left-4 flex flex-col gap-2 sm:bottom-6 sm:left-6">
            <button type="button" onClick={() => setZoom((value) => Math.min(8, value + 0.8))} className="map-explorer-control" aria-label={m.map.zoomIn}><Plus className="size-5" aria-hidden /></button>
            <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.8))} className="map-explorer-control" aria-label={m.map.zoomOut}><Minus className="size-5" aria-hidden /></button>
            <button type="button" onClick={resetView} className="map-explorer-control" aria-label={m.map.resetView}><RotateCcw className="size-4" aria-hidden /></button>
          </div>
          <p className="pointer-events-none absolute right-4 bottom-4 hidden items-center gap-2 rounded-full bg-paper/90 px-3 py-2 text-xs font-semibold text-ink shadow-sm sm:flex"><Move className="size-3.5" aria-hidden /> {m.map.explorerHint}</p>
        </main>
        <aside ref={asideRef} className="min-h-0 overflow-y-auto border-t-2 border-ink/10 bg-card p-5 lg:border-t-0 lg:border-l-2 lg:p-6">
          {selectedCountryCode && shownPage ? <div><p className="flex items-center gap-2 text-sm font-bold tracking-[0.16em] text-collage-red uppercase"><CountryFlag countryCode={selectedCountryCode} svg={flags[selectedCountryCode]} /> {countryName(selectedCountryCode)}</p><h3 className="font-display mt-2 text-4xl leading-none uppercase">{plural(locale, shownPage.total, m.map.artworks)}</h3><p className="mt-3 text-sm text-muted-foreground">{m.map.explorerCountryHint}</p><MapPager page={shownPage} onPageChange={changePage} className="mt-1 -ml-2" /><ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-1">{shownPage.items.map((artwork) => <li key={artwork.slug}><ObraLink obra={artwork} className="group grid overflow-hidden rounded-lg border-2 border-ink/10 bg-paper transition hover:-translate-y-0.5 hover:border-collage-blue focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-collage-blue lg:grid-cols-[5.25rem_1fr]"><img src={imageSrc(artwork.imageUrl, 384)} alt="" width={168} height={120} loading="lazy" decoding="async" className="aspect-square h-full w-full object-cover lg:aspect-auto" /><span className="p-3"><strong className="block truncate text-sm text-ink">{artwork.artworkTitle ?? m.common.untitled}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{artwork.name}</span></span></ObraLink></li>)}</ul><MapPager page={shownPage} onPageChange={changePage} className="mt-4 justify-center" /></div> : <div className="flex min-h-40 flex-col justify-center"><p className="font-display text-3xl uppercase">{m.map.explorerEmptyTitle}</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.map.explorerEmpty}</p></div>}
        </aside>
      </div>
    </DialogContent>
  </Dialog>
}
