import type { Metadata } from 'next'
import { Game } from '@/components/gallery/Game'
import { getGalleryArtworks } from '@/lib/gallery-artworks'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.meta.galleryTitle, description: m.meta.galleryDescription }
}

// The same daily selection of 20 as the homepage — see lib/gallery-artworks.ts.
export const dynamic = 'force-dynamic'

export default async function Galeria3DPage() {
  const { locale } = await getI18n()
  const artworks = await getGalleryArtworks(locale)
  return <Game artworks={artworks} />
}
