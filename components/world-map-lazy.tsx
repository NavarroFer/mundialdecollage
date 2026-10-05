'use client'

import { useEffect, useState, type ComponentProps } from 'react'
import dynamic from 'next/dynamic'
import type { ArtworkSummary } from '@/lib/finalists'
import { loadObras } from '@/lib/obras-client'

// world-map.tsx pulls in react-simple-maps + a 107KB topojson file — split
// it out of the homepage's initial JS since it renders far below the fold.
// The `ssr: false` + dynamic() pairing has to live in a client module; a
// server component can still import and render the client component this
// produces.
const loadMap = () => import('@/components/world-map').then((m) => m.WorldMap)
const WorldMapView = dynamic(loadMap, { ssr: false, loading: () => <MapPlaceholder /> })

function MapPlaceholder() {
  return <div className="aspect-[2/1] w-full animate-pulse rounded-2xl bg-muted" aria-hidden />
}

// The obras the map opens per country come from /api/obras (CDN-cached, the
// same list as the search) rather than the home's server render, which
// carried all of them — ~400 KB of every home page, serialized on every
// visit. Fetched alongside the map's code; until both are here the
// placeholder stays, and a country in the URL (#mapa-AR) opens once they are.
export function WorldMap(props: Omit<ComponentProps<typeof WorldMapView>, 'artworks'>) {
  const [artworks, setArtworks] = useState<ArtworkSummary[] | null>(null)

  useEffect(() => {
    void loadMap()
    let active = true
    loadObras().then(
      (entries) => {
        if (active) setArtworks(entries.map(({ title, ...entry }) => ({ ...entry, artworkTitle: title })))
      },
      // The map still shows each country's count; its obras just can't open.
      () => active && setArtworks([]),
    )
    return () => {
      active = false
    }
  }, [])

  return artworks ? <WorldMapView {...props} artworks={artworks} /> : <MapPlaceholder />
}
