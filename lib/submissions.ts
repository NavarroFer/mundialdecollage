import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// Total count of collage works received for the Mundial, shown in the
// "Primera Edición" banner — real count of completed submissions, never
// hardcoded (ver ROADMAP.md, sección "Primera Edición"). This matches
// /admin/obras' curated "Recibidas" count exactly (one confirmed obra per
// artist, published or not) rather than raw intake — see
// get_total_submissions_count() in
// supabase/migrations/20260921110000_curate_total_submissions_count.sql for
// why a plain `profiles`/`legacy_submissions` count from this anon client
// can't compute that itself. Cached per request: the hero and the edition
// banner both show it.
export const getSubmissionsCount = cache(async (): Promise<number> => {
  if (!isSupabaseConfigured) return 0

  const { data } = await createPublicClient().rpc('get_total_submissions_count')

  return data ?? 0
})
