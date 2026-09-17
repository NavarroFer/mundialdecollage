import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export { countryCodeToName } from '@/lib/participants'

// slug feeds the individual work page route (/obras/[slug]). instagram/website
// are optional and only set when the artist filled them in at submission.
//
// Every submission includes an artwork today (see app/onboarding/actions.ts),
// so this is the same set as getParticipants() — there's no separate
// "confirmed finalist" curation step yet. Once the Mundial wants to show a
// curated subset instead of everyone who submitted, that's an admin flag to
// add here, not a reason to keep two disconnected datasets.
export type Finalist = {
  slug: string
  name: string
  countryCode: string
  artworkTitle: string
  technique?: string
  imageUrl: string
  instagram?: string
  website?: string
}

const SELECT_COLUMNS =
  'artwork_slug, name, country_code, artwork_title, technique, artwork_image_url, instagram, website'

type FinalistRow = {
  artwork_slug: string | null
  name: string | null
  country_code: string | null
  artwork_title: string | null
  technique: string | null
  artwork_image_url: string | null
  instagram: string | null
  website: string | null
}

function rowToFinalist(row: FinalistRow): Finalist | undefined {
  if (!row.artwork_slug || !row.name || !row.country_code || !row.artwork_title || !row.artwork_image_url) {
    return undefined
  }
  return {
    slug: row.artwork_slug,
    name: row.name,
    countryCode: row.country_code,
    artworkTitle: row.artwork_title,
    technique: row.technique ?? undefined,
    imageUrl: row.artwork_image_url,
    instagram: row.instagram ?? undefined,
    website: row.website ?? undefined,
  }
}

// Every finalist with a completed submission, newest first.
export async function getFinalists(): Promise<Finalist[]> {
  if (!isSupabaseConfigured) return []

  const { data } = await createPublicClient()
    .from('profiles')
    .select(SELECT_COLUMNS)
    .not('artwork_slug', 'is', null)
    .order('onboarded_at', { ascending: false })

  return (data ?? []).map(rowToFinalist).filter((f): f is Finalist => f !== undefined)
}

export async function getFinalistBySlug(slug: string): Promise<Finalist | undefined> {
  if (!isSupabaseConfigured) return undefined

  const { data } = await createPublicClient()
    .from('profiles')
    .select(SELECT_COLUMNS)
    .eq('artwork_slug', slug)
    .maybeSingle()

  return data ? rowToFinalist(data) : undefined
}
