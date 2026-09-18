'use client'

import dynamic from 'next/dynamic'

// world-map.tsx pulls in react-simple-maps + a 107KB topojson file — split
// it out of the homepage's initial JS since it renders far below the fold.
// The `ssr: false` + dynamic() pairing has to live in a client module; a
// server component can still import and render the client component this
// produces.
export const WorldMap = dynamic(() => import('@/components/world-map').then((m) => m.WorldMap), {
  ssr: false,
  loading: () => (
    <div className="aspect-[2/1] w-full animate-pulse rounded-2xl bg-muted" aria-hidden />
  ),
})
