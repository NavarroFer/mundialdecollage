import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export { countryCodeToName } from '@/lib/participants'

// slug feeds the individual work page route (/obras/[slug]). instagram/website
// are optional and only set when the artist filled them in at submission.
//
// Every submission gets saved on arrival, but only shows up in getFinalists()
// (the public listing) once an admin publishes it from /admin/obras ("estas
// participan") — the `profiles: public read published` RLS policy (see
// supabase/migrations/20260918000000_profile_visibility.sql) is what
// actually filters that to `is_public = true`, not the query below.
// getFinalistBySlug() is the one exception: see its own comment.
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

// Session-aware client here, unlike getFinalists() above — this lets an
// artist open their own direct /obras/[slug] link and see it before an
// admin has published it ("total la van a ver solo ellos"). RLS combines
// permissive SELECT policies with OR, and none of profiles' policies are
// role-scoped (no `to authenticated`/`to anon`), so this still resolves to
// exactly: owner sees their own row regardless of is_public (via "profiles:
// users read own", auth.uid() = id), everyone else — anonymous or a
// logged-in non-owner — only sees it once is_public = true (via "profiles:
// public read published"). An anonymous visitor gets the same anon-role
// request createPublicClient() would have made, since createClient() falls
// back to the anon key when there's no session cookie.
export async function getFinalistBySlug(slug: string): Promise<Finalist | undefined> {
  if (!isSupabaseConfigured) return undefined

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select(SELECT_COLUMNS)
    .eq('artwork_slug', slug)
    .maybeSingle()

  return data ? rowToFinalist(data) : undefined
}
