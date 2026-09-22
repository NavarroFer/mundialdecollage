import { Suspense } from 'react'
import type { Artwork as ArtworkData } from '@/data/artworks'
import { Artwork } from './Artwork'
import type { GalleryTheme } from '../themes'

export function Artworks({ artworks, theme }: { artworks: ArtworkData[]; theme: GalleryTheme }) {
  return (
    <Suspense fallback={null}>
      {artworks.map((data) => (
        <Artwork key={data.id} data={data} theme={theme} />
      ))}
    </Suspense>
  )
}
