import { cachedPublicData } from '@/lib/public-data-cache'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createPublicClient } from '@/lib/supabase/public'

// The galleries /club shows as examples, picked by an admin in /admin/club
// (supabase/migrations/20261029210000_club_sample_galleries.sql).

export type ClubSample = {
  slug: string
  title: string
  artistName: string
  countryCode: string | null
  obras: number
  coverUrl: string | null
}

type SampleRow = { slug: string; title: string; artist_name: string; country_code: string | null; obras: number; cover_url: string | null }

export const getClubSamples = cachedPublicData(async (): Promise<ClubSample[]> => {
  if (!isSupabaseConfigured) return []
  const { data, error } = await createPublicClient().rpc('club_sample_galleries')
  // Empty rather than an error: the build reads production, where a new
  // migration may land a little after the deploy starts (the migrations
  // workflow does not wait for it). The hourly rebuild fills it in.
  if (error) {
    console.error('getClubSamples: read failed', error.message)
    return []
  }
  return ((data ?? []) as SampleRow[]).map((row) => ({
    slug: row.slug,
    title: row.title,
    artistName: row.artist_name,
    countryCode: row.country_code,
    obras: row.obras,
    coverUrl: row.cover_url,
  }))
}, 'club-samples')
