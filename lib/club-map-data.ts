import { clubHouseFromRow, type ClubHouse, type HouseRow } from '@/lib/club-map'
import { cachedPublicData } from '@/lib/public-data-cache'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createPublicClient } from '@/lib/supabase/public'

/** Every active gallery, placed on the map or not. Read by /api/club/casas, never by a page render. */
export const getClubHouses = cachedPublicData(async (): Promise<ClubHouse[]> => {
  if (!isSupabaseConfigured) return []
  const { data, error } = await createPublicClient().rpc('club_map_houses')
  // Empty rather than an error: the build reads production, where a new
  // migration may land a little after the deploy starts (the migrations
  // workflow does not wait for it). The hourly rebuild fills it in.
  if (error) {
    console.error('getClubHouses: read failed', error.message)
    return []
  }
  return ((data ?? []) as HouseRow[]).map(clubHouseFromRow)
}, 'club-map')
