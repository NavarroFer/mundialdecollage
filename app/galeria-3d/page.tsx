import type { Metadata } from 'next'
import { Game } from '@/components/gallery/Game'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: `Galería 3D — ${site.shortName}`,
  description: 'Recorré la galería del Mundial de Collage en 3D desde el navegador.',
}

export default function Galeria3DPage() {
  return <Game />
}
