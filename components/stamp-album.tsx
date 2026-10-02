import { StampAlbumClient } from '@/components/stamp-album-client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isStampKey } from '@/lib/stamps'
import { createPublicClient } from '@/lib/supabase/public'

export type CollectedArtworkStamp = { slug: string; title: string; artist: string; image: string; collectedAt: string }

export async function StampAlbum() {
  if (!isSupabaseConfigured) return <StampAlbumClient signedIn={false} unlockedStamps={[]} artworkStamps={[]} />
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return <StampAlbumClient signedIn={false} unlockedStamps={[]} artworkStamps={[]} />
  const { data } = await supabase.from('profile_stamps').select('stamp_key')
  const unlockedStamps = (data ?? []).flatMap((row) => isStampKey(row.stamp_key) ? [row.stamp_key] : [])
  const { data: collected } = await supabase.from('artwork_stamp_collections').select('artwork_id, collected_at').order('collected_at', { ascending: false }).limit(60)
  const ids = (collected ?? []).map((row) => row.artwork_id)
  const { data: artworks } = ids.length
    ? await createPublicClient().from('artworks').select('id, slug, title, image_url, profiles!inner(name)').in('id', ids)
    : { data: [] }
  const byId = new Map((artworks ?? []).map((row) => [row.id, row] as const))
  const artworkStamps: CollectedArtworkStamp[] = (collected ?? []).flatMap((row) => {
    const artwork = byId.get(row.artwork_id) as { slug: string | null; title: string | null; image_url: string | null; profiles: { name: string | null } | null } | undefined
    return artwork?.slug && artwork.image_url && artwork.profiles?.name
      ? [{ slug: artwork.slug, title: artwork.title?.trim() || 'Sin título', image: artwork.image_url, artist: artwork.profiles.name, collectedAt: row.collected_at }]
      : []
  })
  return <StampAlbumClient signedIn unlockedStamps={unlockedStamps} artworkStamps={artworkStamps} />
}
