import { cachedPublicData } from '@/lib/public-data-cache'
import { artistTag } from '@/lib/public-cache-tags'
import { buildArtistCard, type ArtistCard, type ArtistCardRow } from '@/lib/artist-card'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createPublicClient } from '@/lib/supabase/public'

// The anonymous client on purpose, like the profile page: only what the public
// policies show. Cached for an hour and dropped with the artist's other public
// data (artistTag) when they change something.
export const getArtistCard = cachedPublicData(async (profileId: string): Promise<ArtistCard | null> => {
  if (!isSupabaseConfigured) return null
  const { data, error } = await createPublicClient()
    .from('artworks')
    .select('slug, technique, image_url, profiles!inner(name, country_code, instagram, website)')
    .eq('profile_id', profileId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return buildArtistCard((data ?? []) as unknown as ArtistCardRow[]) ?? null
}, 'artist-card', (profileId) => [artistTag(profileId)])
