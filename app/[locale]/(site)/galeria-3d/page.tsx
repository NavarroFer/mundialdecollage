import type { Metadata } from 'next'
import { GalleryAccess, GalleryGuest, GallerySignIn } from '@/components/gallery/GalleryAccess'
import { getCurrentUser } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getGalleryArtworks } from '@/lib/gallery-artworks'
import { getI18n } from '@/lib/i18n/server'
import { StampVisit } from '@/components/stamp-visit'
import type { GalleryVenue } from '@/components/gallery/venue'

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n()
  return { title: m.meta.galleryTitle, description: m.meta.galleryDescription }
}

// The same daily selection as the homepage — see lib/gallery-artworks.ts.
export const dynamic = 'force-dynamic'

export default async function Galeria3DPage({ venue }: { venue?: GalleryVenue } = {}) {
  const { locale } = await getI18n()
  const user = isSupabaseConfigured ? await getCurrentUser() : null
  // Museo MAR is not public yet (only the admin links to /museomar), so its
  // door lets anyone in without an account, and the visit stays in MAR. The
  // Collage World Cup's gallery still asks to sign in.
  if (!user && venue !== 'mar') return <GallerySignIn />
  const artworks = await getGalleryArtworks(locale)
  if (!user) return <GalleryGuest artworks={artworks} venue="mar" />
  return <><StampVisit stamp="gallery" /><GalleryAccess artworks={artworks} userId={user.id} initialVenue={venue} /></>
}
