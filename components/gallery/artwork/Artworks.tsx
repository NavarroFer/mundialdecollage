import { Suspense } from 'react'
import type { Artwork as ArtworkData } from '@/data/artworks'
import { Artwork } from './Artwork'

export function Artworks({ artworks }: { artworks: ArtworkData[] }) {
  return (
    <Suspense fallback={null}>
      {artworks.map((data) => (
        <Artwork key={data.id} data={data} />
      ))}
    </Suspense>
  )
}
