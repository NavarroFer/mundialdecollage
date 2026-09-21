import type { Metadata } from 'next'
import { Game } from '@/components/gallery/Game'
import { getGalleryArtworks } from '@/lib/gallery-artworks'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: `Galería 3D — ${site.shortName}`,
  description: 'Recorré la galería del Mundial de Collage en 3D desde el navegador.',
}

// A fresh, date-seeded random 15 every day — see lib/gallery-artworks.ts.
export const dynamic = 'force-dynamic'

export default async function Galeria3DPage() {
  const artworks = await getGalleryArtworks()
  return <Game artworks={artworks} />
}
