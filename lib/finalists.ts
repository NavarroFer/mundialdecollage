import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { cachedPublicData } from '@/lib/public-data-cache'

export { countryCodeToName } from '@/lib/participants'

// slug feeds the individual work page route (/obras/[slug]). instagram/website
// are optional and only set when the artist filled them in at submission.
//
// Every submission gets saved on arrival, but only shows up in getFinalists()
// (the public listing) once its artwork is both `is_selected` (admin-curated
// — see supabase/migrations/20260921040000_artworks.sql) and its profile is
// published ("estas participan" from /admin/obras) — the "artworks: public
// read of published profiles" RLS policy is what actually filters that, not
// the query below. getFinalistBySlug() is the one exception: see its own
// comment.
export type Finalist = {
  profileId: string
  slug: string
  name: string
  countryCode: string
  // Empty when nobody has given the obra a real title yet; shown as
  // m.common.untitled until the artist writes it (see confirmArtistDetails).
  artworkTitle: string | null
  technique?: string
  imageUrl: string
  instagram?: string
  website?: string
}

const SELECT_COLUMNS = 'slug, title, technique, image_url, profiles!inner(id, name, country_code, instagram, website)'

type FinalistRow = {
  slug: string | null
  title: string | null
  technique: string | null
  image_url: string | null
  profiles: {
    id: string | null
    name: string | null
    country_code: string | null
    instagram: string | null
    website: string | null
  } | null
}

function rowToFinalist(row: FinalistRow): Finalist | undefined {
  const profile = row.profiles
  if (!row.slug || !row.image_url || !profile?.id || !profile.name || !profile.country_code) {
    return undefined
  }
  return {
    profileId: profile.id,
    slug: row.slug,
    name: profile.name,
    countryCode: profile.country_code,
    artworkTitle: row.title?.trim() || null,
    technique: row.technique ?? undefined,
    imageUrl: row.image_url,
    instagram: profile.instagram ?? undefined,
    website: profile.website ?? undefined,
  }
}

// Every finalist with a completed, curated submission, newest first. Cached
// across requests (lib/public-data-cache.ts) and per request, so the home's
// flag ribbon and map share one query.
export const getFinalists = cache(cachedPublicData(async (): Promise<Finalist[]> => {
  if (!isSupabaseConfigured) return []

  const { data } = await createPublicClient()
    .from('artworks')
    .select(SELECT_COLUMNS)
    .eq('is_selected', true)
    .order('created_at', { ascending: false })

  // `profiles!inner(...)` is a many-to-one embed (an artwork has exactly one
  // profile), but supabase-js's select-string type inference can't know
  // that without generated DB types and defaults to an array — the actual
  // runtime shape from PostgREST is a single object, matching FinalistRow.
  return ((data ?? []) as unknown as FinalistRow[])
    .map(rowToFinalist)
    .filter((f): f is Finalist => f !== undefined)
}, 'finalists'))

// The public finalists among these artwork ids, keyed by id — RLS drops any
// that are no longer selected/published. Used for the daily exhibition
// (lib/gallery-artworks.ts), which stores artwork ids.
export async function getFinalistsByIds(ids: string[]): Promise<Map<string, Finalist>> {
  if (!isSupabaseConfigured || ids.length === 0) return new Map()

  const { data } = await createPublicClient()
    .from('artworks')
    .select(`id, ${SELECT_COLUMNS}`)
    .in('id', ids)

  const found = new Map<string, Finalist>()
  for (const row of (data ?? []) as unknown as (FinalistRow & { id: string })[]) {
    const finalist = rowToFinalist(row)
    if (finalist) found.set(row.id, finalist)
  }
  return found
}

// Session-aware client here, unlike getFinalists() above — this lets an
// artist open their own direct /obras/[slug] link and see it before it's
// been curated/published ("total la van a ver solo ellos"). RLS combines
// permissive SELECT policies with OR, and none of artworks' policies are
// role-scoped (no `to authenticated`/`to anon`), so this still resolves to
// exactly: owner sees their own row regardless of is_selected/is_public (via
// "artworks: owner read own", profile_id = auth.uid()), everyone else —
// anonymous or a logged-in non-owner — only sees it once it's selected AND
// its profile is published (via "artworks: public read of published
// profiles"). An anonymous visitor gets the same anon-role request
// createPublicClient() would have made, since createClient() falls back to
// the anon key when there's no session cookie.
export const getFinalistBySlug = cache(async (slug: string): Promise<Finalist | undefined> => {
  if (!isSupabaseConfigured) return undefined

  const supabase = await createClient()
  const { data } = await supabase.from('artworks').select(SELECT_COLUMNS).eq('slug', slug).maybeSingle()

  return data ? rowToFinalist(data as unknown as FinalistRow) : undefined
})

// The same obra as anyone without a session sees it: only once it's
// published. What link previews (opengraph-image) render, so an obra still
// under review never leaks through a crawler.
export const getPublishedFinalistBySlug = cachedPublicData(async (slug: string): Promise<Finalist | undefined> => {
  if (!isSupabaseConfigured) return undefined

  const { data } = await createPublicClient().from('artworks').select(SELECT_COLUMNS).eq('slug', slug).maybeSingle()

  return data ? rowToFinalist(data as unknown as FinalistRow) : undefined
}, 'published-finalist')

// Whether a link to this obra works for everyone, and whether the reader is
// the artist — which decides what components/share-artwork.tsx offers.
export async function getArtworkShareState(slug: string): Promise<{ isPublic: boolean; isOwn: boolean }> {
  if (!isSupabaseConfigured) return { isPublic: false, isOwn: false }

  const [published, user] = await Promise.all([
    createPublicClient().from('artworks').select('slug').eq('slug', slug).maybeSingle(),
    getCurrentUser(),
  ])
  let isOwn = false
  if (user) {
    const { data } = await (await createClient()).from('artworks').select('profile_id').eq('slug', slug).maybeSingle()
    isOwn = data?.profile_id === user.id
  }
  return { isPublic: Boolean(published.data), isOwn }
}

// The obra behind a signed certificate link (app/obras/[slug]/certificado
// ?t=): read with the service role, since the reader has no session and the
// profile may not be published, but only while it's still a curated,
// unarchived participation — the same rule certificate_recipients() mails by.
export async function getCertificateFinalistBySlug(slug: string): Promise<Finalist | undefined> {
  if (!isSupabaseConfigured) return undefined

  const { data } = await createAdminClient()
    .from('artworks')
    .select(SELECT_COLUMNS)
    .eq('slug', slug)
    .eq('is_selected', true)
    .is('archived_at', null)
    .maybeSingle()

  return data ? rowToFinalist(data as unknown as FinalistRow) : undefined
}
