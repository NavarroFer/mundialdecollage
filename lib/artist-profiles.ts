import { cache } from 'react'
import { cachedPublicData } from '@/lib/public-data-cache'
import { artistTag } from '@/lib/public-cache-tags'
import { slugify } from '@/lib/slug'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'

const PROFILE_ID_SUFFIX = /([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i

export type ArtistProfileArtwork = {
  slug: string
  title: string | null
  technique?: string
  imageUrl: string
}

export type ArtistProfile = {
  slug: string
  name: string
  countryCode: string
  instagram?: string
  website?: string
  artworks: ArtistProfileArtwork[]
}

type ArtistArtworkRow = {
  slug: string | null
  title: string | null
  technique: string | null
  image_url: string | null
  profiles: {
    id: string
    name: string | null
    country_code: string | null
    instagram: string | null
    website: string | null
  } | null
}

/**
 * Builds a collision-free artist URL from fields that already exist. Keeping
 * the full profile id makes the route stable if the display name changes and
 * avoids adding a public-slug migration before launch.
 */
export function artistProfileSlug(name: string, profileId: string): string {
  return `${slugify(name) || 'artista'}-${profileId.toLowerCase()}`
}

export function artistProfileIdFromSlug(slug: string): string | undefined {
  return PROFILE_ID_SUFFIX.exec(slug)?.[1]?.toLowerCase()
}

const ARTIST_SELECT = 'slug, title, technique, image_url, profiles!inner(id, name, country_code, instagram, website)'

function profileFromRows(rows: ArtistArtworkRow[]): ArtistProfile | undefined {
  const firstProfile = rows[0]?.profiles
  if (!firstProfile?.name || !firstProfile.country_code) return undefined

  const artworks = rows.flatMap((row): ArtistProfileArtwork[] => {
    if (!row.slug || !row.image_url) return []
    return [{
      slug: row.slug,
      title: row.title?.trim() || null,
      technique: row.technique ?? undefined,
      imageUrl: row.image_url,
    }]
  })
  if (artworks.length === 0) return undefined

  return {
    slug: artistProfileSlug(firstProfile.name, firstProfile.id),
    name: firstProfile.name,
    countryCode: firstProfile.country_code,
    instagram: firstProfile.instagram ?? undefined,
    website: firstProfile.website ?? undefined,
    artworks,
  }
}

// The anonymous client is intentional: even when the reader is the artist,
// this page must contain only works that the public RLS policy allows. Today
// that is the selected work; if the policy later exposes more entered works,
// this query starts showing all of them without changing the route.
const getArtistProfileById = cachedPublicData(async (profileId: string): Promise<ArtistProfile | undefined> => {
  if (!isSupabaseConfigured) return undefined

  const { data, error } = await createPublicClient()
    .from('artworks')
    .select(ARTIST_SELECT)
    .eq('profile_id', profileId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return profileFromRows((data ?? []) as unknown as ArtistArtworkRow[])
}, 'artist-profile', (profileId) => [artistTag(profileId)])

export const getArtistProfileBySlug = cache(async (slug: string): Promise<ArtistProfile | undefined> => {
  const profileId = artistProfileIdFromSlug(slug)
  return profileId ? getArtistProfileById(profileId) : undefined
})

/**
 * The artist's own profile before an admin publishes it, read with their
 * session ("owner read own" policies). Only the owner gets it: anyone else
 * still gets the 404 the public query gives. Never cached, never public.
 */
export async function getOwnArtistPreview(slug: string, viewerId: string | undefined): Promise<ArtistProfile | undefined> {
  const profileId = artistProfileIdFromSlug(slug)
  if (!isSupabaseConfigured || !profileId || !viewerId || profileId !== viewerId.toLowerCase()) return undefined
  const { data, error } = await (await createClient())
    .from('artworks')
    .select(ARTIST_SELECT)
    .eq('profile_id', profileId)
    .is('archived_at', null)
    .order('is_selected', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return profileFromRows((data ?? []) as unknown as ArtistArtworkRow[])
}
