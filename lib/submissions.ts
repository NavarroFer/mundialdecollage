import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { cachedPublicData } from '@/lib/public-data-cache'

// Total count of works received for the Mundial, shown in the "Primera
// Edición" banner. It deliberately counts every active Registro row and
// every native entered artwork without a Registro counterpart: multiple
// works sent by one artist are separate received works. Cached across
// requests (lib/public-data-cache.ts) and per request: the hero and the
// edition banner both show it.
export const getSubmissionsCount = cache(cachedPublicData(async (): Promise<number> => {
  if (!isSupabaseConfigured) return 0

  const { data } = await createPublicClient().rpc('get_total_submissions_count')

  return data ?? 0
}, 'submissions-count'))
