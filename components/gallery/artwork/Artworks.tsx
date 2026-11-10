import { Suspense } from 'react'
import type { Artwork as ArtworkData } from '@/data/artworks'
import { Artwork } from './Artwork'
import type { GalleryTheme } from '../themes'

export function Artworks({ artworks, theme, placard = false }: { artworks: ArtworkData[]; theme: GalleryTheme; /** Wall text beside each frame (see Artwork). */ placard?: boolean }) {
  return (
    <Suspense fallback={null}>
      {artworks.map((data) => (
        <Artwork key={data.id} data={data} theme={theme} placard={placard} />
      ))}
    </Suspense>
  )
}
