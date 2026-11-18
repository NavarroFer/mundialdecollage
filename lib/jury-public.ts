// The jury as visitors see it (public.public_jury()): empty until the
// organizers publish it from /admin/jurado, so the home, the obra feed and
// «El mundial» show it all at once by the same switch. Cached across requests
// (lib/public-data-cache.ts); the switch calls refreshPublicData().
import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { cachedPublicData } from '@/lib/public-data-cache'

export type PublicJuror = {
  id: string
  name: string
  countryCode: string
  jobTitle: string
  photoPath: string | null
  bioShort: string | null
  bioMedium: string | null
}

type Row = {
  id: string
  name: string
  country_code: string
  job_title: string
  photo_path: string | null
  bio_short: string | null
  bio_medium: string | null
}

export const toPublicJuror = (row: Row): PublicJuror => ({
  id: row.id,
  name: row.name,
  countryCode: row.country_code,
  jobTitle: row.job_title,
  photoPath: row.photo_path,
  bioShort: row.bio_short,
  bioMedium: row.bio_medium,
})

// Any failure (e.g. the migration hasn't run yet) reads as «not published»:
// the jury never shows by mistake.
export const getPublicJury = cachedPublicData(async (): Promise<PublicJuror[]> => {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await createPublicClient().rpc('public_jury')
    if (error || !data) return []
    return (data as Row[]).map(toPublicJuror)
  } catch {
    return []
  }
}, 'jury')
