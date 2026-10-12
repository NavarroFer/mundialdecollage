import type { Metadata } from 'next'
import { GalleryAccess, GallerySignIn } from '@/components/gallery/GalleryAccess'
import { getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getGalleryArtworks } from '@/lib/gallery-artworks'
import { getI18n } from '@/lib/i18n/server'
import { StampVisit } from '@/components/stamp-visit'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.meta.galleryTitle, description: m.meta.galleryDescription }
}

// The same daily selection as the homepage — see lib/gallery-artworks.ts.
export const dynamic = 'force-dynamic'

export default async function Galeria3DPage() {
  const { locale } = await getI18n()
  const user = isSupabaseConfigured ? await getCurrentUser() : null
  if (!user) return <GallerySignIn />
  const artworks = await getGalleryArtworks(locale)
  return <><StampVisit stamp="gallery" /><GalleryAccess artworks={artworks} userId={user.id} /></>
}
