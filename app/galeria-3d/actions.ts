'use server'

import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { normalizeLikeEmail } from '@/lib/gallery-identity'
import { ADMIN_EMAILS } from '@/lib/admin'

// Error codes, not sentences: the gallery shows them in the reader's language.
const unavailable = 'unavailable'
const COMMENT_MAX = 500
// Enough for a conversation, not for flooding the moderation queue.
const COMMENTS_PER_10_MIN = 5
const PENDING_PER_USER = 20

// Likes and comments need a Google session: the gallery sends visitors to
// sign in and brings them back to the same obra (lib/gallery-return.ts).
async function getSessionUser(): Promise<User | null> {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  return user
}

function isConfigured() {
  return isSupabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function validSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && slug.length > 0 && slug.length <= 300
}

// Only obras the public can see (RLS on the anon client) take likes/comments.
async function publicArtworkId(slug: string): Promise<string | null> {
  const { data, error } = await createPublicClient().from('artworks').select('id').eq('slug', slug).maybeSingle()
  return error || !data ? null : data.id
}

type AdminClient = ReturnType<typeof createAdminClient>
type LikeState = { count: number; liked: boolean; signedIn: boolean }

async function likeState(admin: AdminClient, artworkId: string, email: string | null): Promise<LikeState | null> {
  const [total, own] = await Promise.all([
    admin.from('artwork_likes').select('*', { count: 'exact', head: true }).eq('artwork_id', artworkId),
    email ? admin.from('artwork_likes').select('artwork_id').eq('artwork_id', artworkId).eq('email', email).maybeSingle() : null,
  ])
  if (total.error || own?.error) return null
  return { count: total.count ?? 0, liked: Boolean(own?.data), signedIn: Boolean(email) }
}

export async function getArtworkLike(slug: string): Promise<LikeState | { error: string }> {
  if (!isConfigured() || !validSlug(slug)) return { error: unavailable }
  try {
    const artworkId = await publicArtworkId(slug)
    if (!artworkId) return { error: unavailable }
    const like = await likeState(createAdminClient(), artworkId, normalizeLikeEmail((await getSessionUser())?.email))
    return like ?? { error: unavailable }
  } catch {
    return { error: unavailable }
  }
}

export async function likeArtwork(slug: string) {
  if (!isConfigured() || !validSlug(slug)) return { error: unavailable }
  try {
    const email = normalizeLikeEmail((await getSessionUser())?.email)
    if (!email) return { error: 'sign_in_required' }
    const { error } = await createAdminClient().rpc('like_gallery_artwork', { artwork_slug: slug, voter_email: email })
    if (error) return { error: 'save_failed' }
    return { liked: true }
  } catch {
    return { error: 'save_failed' }
  }
}

export type ArtworkStampResult = {
  status: 'collected' | 'already_collected' | 'limit_reached'
  remaining: number
  resetsAt: string | null
}

export async function collectArtworkStamp(slug: string): Promise<ArtworkStampResult | { error: string }> {
  if (!isSupabaseConfigured || !validSlug(slug)) return { error: unavailable }
  try {
    const user = await getSessionUser()
    if (!user) return { error: 'sign_in_required' }
    const client = await createClient()
    const { data, error } = await client.rpc('collect_gallery_artwork_stamp', { artwork_slug: slug }).single()
    if (error || !data) return { error: 'save_failed' }
    const row = data as { status: ArtworkStampResult['status']; remaining: number; resets_at: string | null }
    if (!['collected', 'already_collected', 'limit_reached'].includes(row.status)) return { error: 'save_failed' }
    return { status: row.status, remaining: row.remaining, resetsAt: row.resets_at }
  } catch {
    return { error: 'save_failed' }
  }
}

export type GalleryComment = {
  id: string
  author: string
  body: string
  createdAt: string
  /** Only ever true on the viewer's own comments: others never see pending ones. */
  pending: boolean
}

type CommentRow = { id: string; author_name: string; body: string; created_at: string; status: string }

function toComment(row: CommentRow): GalleryComment {
  return { id: row.id, author: row.author_name, body: row.body, createdAt: row.created_at, pending: row.status === 'pending' }
}

type CommentsState = { comments: GalleryComment[]; signedIn: boolean }

// Approved comments, plus the viewer's own that are still waiting for review.
async function commentsState(admin: AdminClient, artworkId: string, user: User | null): Promise<CommentsState | null> {
  const columns = 'id, author_name, body, created_at, status'
  const [approved, own] = await Promise.all([
    admin.from('artwork_comments').select(columns).eq('artwork_id', artworkId).eq('status', 'approved')
      .order('created_at', { ascending: true }).limit(100),
    user
      ? admin.from('artwork_comments').select(columns).eq('artwork_id', artworkId).eq('user_id', user.id).eq('status', 'pending')
      : Promise.resolve({ data: [] as CommentRow[], error: null }),
  ])
  if (approved.error || own.error) return null
  const comments = [...(approved.data ?? []), ...(own.data ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(toComment)
  return { comments, signedIn: Boolean(user) }
}

// Signed in but not an artist yet (e.g. a friend who came to like an obra):
// the modal invites them to send their own after a like or comment. Admins
// never submit (lib/admin.ts), and a failed read counts as "already an
// artist" so a real one is never nagged.
async function canJoin(admin: AdminClient, user: User | null): Promise<boolean> {
  if (!user || ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) return false
  try {
    const { data, error } = await admin.from('profiles').select('onboarded_at').eq('id', user.id).maybeSingle()
    return !error && !data?.onboarded_at
  } catch {
    return false
  }
}

export type ArtworkSocial = { like: LikeState; comments: CommentsState; canJoin: boolean }

// Everything the obra's modal needs in one round trip, so likes and comments
// arrive together (and the gallery can fetch it before E is pressed).
export async function getArtworkSocial(slug: string): Promise<ArtworkSocial | { error: string }> {
  if (!isConfigured() || !validSlug(slug)) return { error: unavailable }
  try {
    const [artworkId, user] = await Promise.all([publicArtworkId(slug), getSessionUser()])
    if (!artworkId) return { error: unavailable }
    const admin = createAdminClient()
    const [like, comments, join] = await Promise.all([
      likeState(admin, artworkId, normalizeLikeEmail(user?.email)),
      commentsState(admin, artworkId, user),
      canJoin(admin, user),
    ])
    if (!like || !comments) return { error: unavailable }
    return { like, comments, canJoin: join }
  } catch {
    return { error: unavailable }
  }
}

// The name comments are signed with: what the artist wrote in their profile,
// else their Google name, else the part of the email before the @.
async function authorName(user: User): Promise<string> {
  const { data: profile } = await createAdminClient().from('profiles').select('name').eq('id', user.id).maybeSingle()
  const metadata = user.user_metadata ?? {}
  const candidates = [profile?.name, metadata.full_name, metadata.name, user.email?.split('@')[0]]
  const name = candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0)
  return (name ?? 'Visitante').trim().slice(0, 80)
}

export async function addArtworkComment(slug: string, body: string): Promise<{ comment: GalleryComment } | { error: string }> {
  if (!isConfigured() || !validSlug(slug)) return { error: unavailable }
  const text = typeof body === 'string' ? body.trim() : ''
  if (!text) return { error: 'empty' }
  if (text.length > COMMENT_MAX) return { error: 'too_long' }
  try {
    const user = await getSessionUser()
    if (!user) return { error: 'sign_in_required' }
    const artworkId = await publicArtworkId(slug)
    if (!artworkId) return { error: unavailable }

    const admin = createAdminClient()
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const [recent, pending] = await Promise.all([
      admin.from('artwork_comments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since),
      admin.from('artwork_comments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
    ])
    if (recent.error || pending.error) return { error: 'save_failed' }
    if ((recent.count ?? 0) >= COMMENTS_PER_10_MIN || (pending.count ?? 0) >= PENDING_PER_USER) return { error: 'rate_limited' }

    const { data, error } = await admin.from('artwork_comments')
      .insert({
        artwork_id: artworkId,
        user_id: user.id,
        author_name: await authorName(user),
        author_email: user.email?.toLowerCase() ?? null,
        body: text,
      })
      .select('id, author_name, body, created_at, status')
      .single()
    if (error || !data) return { error: 'save_failed' }
    return { comment: toComment(data) }
  } catch {
    return { error: 'save_failed' }
  }
}
