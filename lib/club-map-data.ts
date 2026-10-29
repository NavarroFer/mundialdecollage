import { clubHouseFromRow, type ClubHouse, type HouseRow } from '@/lib/club-map'
import { cachedPublicData } from '@/lib/public-data-cache'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createPublicClient } from '@/lib/supabase/public'

/** Every active gallery with a house. Read by /api/club/casas, never by a page render. */
export const getClubHouses = cachedPublicData(async (): Promise<ClubHouse[]> => {
  if (!isSupabaseConfigured) return []
  const { data, error } = await createPublicClient().rpc('club_map_houses')
  if (error) throw new Error(error.message)
  return ((data ?? []) as HouseRow[]).map(clubHouseFromRow)
}, 'club-map')
