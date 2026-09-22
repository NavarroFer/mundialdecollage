import type { Metadata } from 'next'
import { Game } from '@/components/gallery/Game'
import { getGalleryArtworks } from '@/lib/gallery-artworks'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: `Galería 3D — ${site.shortName}`,
  description: 'Jugá y explorá la muestra diaria del Mundial de Collage en 3D. Entrá gratis desde el navegador y descubrí una selección distinta de obras cada día.',
}

// The same daily selection of 20 as the homepage — see lib/gallery-artworks.ts.
export const dynamic = 'force-dynamic'

export default async function Galeria3DPage() {
  const artworks = await getGalleryArtworks()
  return <Game artworks={artworks} />
}
