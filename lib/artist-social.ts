import { artistProfileIdFromSlug } from '@/lib/artist-profiles'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createPublicClient } from '@/lib/supabase/public'

// What an artist's profile shows next to their obras, Instagram-style: likes
// and approved comments per obra, the totals, and the latest comments. Read
// with the service role (artwork_likes and artwork_comments have no public
// grant) and handed out only as counts plus what the 3D gallery already
// shows publicly: author name, text, date. Never emails or user ids.

/** How many of the latest comments the profile lists. */
export const ARTIST_COMMENTS_SHOWN = 30

export type ArtistSocialComment = {
  id: string
  artworkSlug: string
  author: string
  body: string
  createdAt: string
}

export type ArtistSocial = {
  /** Per obra slug. Obras without likes or comments are listed with zeros. */
  artworks: Record<string, { likes: number; comments: number }>
  totals: { likes: number; comments: number }
  /** Newest first, at most ARTIST_COMMENTS_SHOWN. */
  comments: ArtistSocialComment[]
  /**
   * The artist's Club gallery while it's active, so the profile can lead to
   * it. Here rather than in the page: a gallery starts or stops with a
   * payment, which nothing in the app hears, and this answer is at most
   * 10 minutes old while the profile's static copy can be a day old.
   */
  club?: { slug: string; title: string } | null
}

type ArtworkRef = { id: string; slug: string }
type Counts = { artworkId: string; likes: number; comments: number }
type CommentRow = { id: string; artwork_id: string; author_name: string; body: string; created_at: string }

export function buildArtistSocial(artworks: ArtworkRef[], counts: Counts[], comments: CommentRow[]): ArtistSocial {
  const slugById = new Map(artworks.map((artwork) => [artwork.id, artwork.slug]))
  const countsById = new Map(counts.map((count) => [count.artworkId, count]))
  const perArtwork: ArtistSocial['artworks'] = {}
  const totals = { likes: 0, comments: 0 }
  for (const { id, slug } of artworks) {
    const count = countsById.get(id)
    const likes = count?.likes ?? 0
    const commentCount = count?.comments ?? 0
    perArtwork[slug] = { likes, comments: commentCount }
    totals.likes += likes
    totals.comments += commentCount
  }
  return {
    artworks: perArtwork,
    totals,
    comments: comments
      .flatMap((row): ArtistSocialComment[] => {
        const artworkSlug = slugById.get(row.artwork_id)
        return artworkSlug
          ? [{ id: row.id, artworkSlug, author: row.author_name, body: row.body, createdAt: row.created_at }]
          : []
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, ARTIST_COMMENTS_SHOWN),
  }
}

// Active galleries are public (RLS "club galleries: public reads active").
async function activeClubGallery(profileId: string): Promise<ArtistSocial['club']> {
  const { data, error } = await createPublicClient()
    .from('club_galleries')
    .select('slug, title')
    .eq('user_id', profileId)
    .eq('status', 'active')
    .maybeSingle()
  // The likes and comments still matter without it.
  if (error) {
    console.error('artist social: club gallery read failed', error.message)
    return null
  }
  return data ? { slug: data.slug, title: data.title } : null
}

export async function getArtistSocial(slug: string): Promise<ArtistSocial | undefined> {
  const profileId = artistProfileIdFromSlug(slug)
  if (!profileId || !isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return undefined

  // The same obras the profile shows: the anonymous client, so RLS decides.
  const { data, error } = await createPublicClient()
    .from('artworks')
    .select('id, slug')
    .eq('profile_id', profileId)
    .is('archived_at', null)
  if (error) throw new Error(error.message)
  const artworks = (data ?? []).filter((row): row is ArtworkRef => Boolean(row.slug))
  if (artworks.length === 0) return undefined

  const admin = createAdminClient()
  const ids = artworks.map((artwork) => artwork.id)
  // An artist has a handful of obras: two head counts each beat paging
  // through every like row.
  const [counts, latest] = await Promise.all([
    Promise.all(artworks.map(async ({ id }): Promise<Counts> => {
      const [likes, comments] = await Promise.all([
        admin.from('artwork_likes').select('*', { count: 'exact', head: true }).eq('artwork_id', id),
        admin.from('artwork_comments').select('id', { count: 'exact', head: true }).eq('artwork_id', id).eq('status', 'approved'),
      ])
      if (likes.error) throw new Error(likes.error.message)
      if (comments.error) throw new Error(comments.error.message)
      return { artworkId: id, likes: likes.count ?? 0, comments: comments.count ?? 0 }
    })),
    admin.from('artwork_comments')
      .select('id, artwork_id, author_name, body, created_at')
      .in('artwork_id', ids)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(ARTIST_COMMENTS_SHOWN),
  ])
  if (latest.error) throw new Error(latest.error.message)
  return { ...buildArtistSocial(artworks, counts, (latest.data ?? []) as CommentRow[]), club: await activeClubGallery(profileId) }
}
