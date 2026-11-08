import type { SupabaseClient } from '@supabase/supabase-js'
import { imageSrc } from '@/lib/image-src'
import { getSiteUrl } from '@/lib/site'

// What the «tu perfil ya está online» mail shows of each artist's own
// profile: their obra, and the totals the profile counts. Read once per
// send for the whole audience (a handful of queries), never per recipient.

export type ProfileMailData = {
  /** Absolute URL of the obra, resized and cached by app/api/img. */
  imageUrl: string
  title: string | null
  obras: number
  likes: number
  comments: number
}

type ArtworkRow = { id: string; profile_id: string; title: string | null; image_url: string | null; is_selected: boolean | null; created_at: string }

const IDS_PER_QUERY = 150
const PAGE = 1000
/** Wide enough for the mail's 536px column on a 2x screen, one of IMAGE_WIDTHS. */
export const PROFILE_MAIL_IMAGE_WIDTH = 1080

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** The obra a profile leads with: the one chosen to take part, else the newest. */
export function leadArtwork(rows: ArtworkRow[]): ArtworkRow | undefined {
  return rows
    .filter((row) => row.image_url?.trim())
    .sort((a, b) => Number(Boolean(b.is_selected)) - Number(Boolean(a.is_selected)) || b.created_at.localeCompare(a.created_at))[0]
}

export function mailImageUrl(storedUrl: string): string {
  const src = imageSrc(storedUrl, PROFILE_MAIL_IMAGE_WIDTH)
  return src.startsWith('/') ? `${getSiteUrl()}${src}` : src
}

// artwork_id of every row, paged: PostgREST returns at most 1000 at a time.
async function countByArtwork(db: SupabaseClient, table: 'artwork_likes' | 'artwork_comments', artworkIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const ids of chunks(artworkIds, IDS_PER_QUERY)) {
    for (let from = 0; ; from += PAGE) {
      let query = db.from(table).select('artwork_id').in('artwork_id', ids).order('artwork_id')
      if (table === 'artwork_comments') query = query.eq('status', 'approved')
      const { data, error } = await query.range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) counts.set(row.artwork_id, (counts.get(row.artwork_id) ?? 0) + 1)
      if ((data?.length ?? 0) < PAGE) break
    }
  }
  return counts
}

/** Keyed by profile id. A profile with no obra that has an image is left out. */
export async function profileMailData(db: SupabaseClient, profileIds: string[]): Promise<Map<string, ProfileMailData>> {
  const rows: ArtworkRow[] = []
  for (const ids of chunks(profileIds, IDS_PER_QUERY)) {
    const { data, error } = await db
      .from('artworks')
      .select('id, profile_id, title, image_url, is_selected, created_at')
      .in('profile_id', ids)
      .is('archived_at', null)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as ArtworkRow[]))
  }
  const [likes, comments] = await Promise.all([
    countByArtwork(db, 'artwork_likes', rows.map((row) => row.id)),
    countByArtwork(db, 'artwork_comments', rows.map((row) => row.id)),
  ])

  const byProfile = new Map<string, ArtworkRow[]>()
  for (const row of rows) byProfile.set(row.profile_id, [...(byProfile.get(row.profile_id) ?? []), row])

  const result = new Map<string, ProfileMailData>()
  for (const [profileId, artworks] of byProfile) {
    const lead = leadArtwork(artworks)
    if (!lead?.image_url) continue
    result.set(profileId, {
      imageUrl: mailImageUrl(lead.image_url),
      title: lead.title,
      obras: artworks.length,
      likes: artworks.reduce((sum, artwork) => sum + (likes.get(artwork.id) ?? 0), 0),
      comments: artworks.reduce((sum, artwork) => sum + (comments.get(artwork.id) ?? 0), 0),
    })
  }
  return result
}
