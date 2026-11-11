'use server'

import { after } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { authorName } from '@/lib/gallery-author'
import { enrichCommunityComment, enrichCommunityPost } from '@/lib/community-ai'
import {
  COMMENT_BODY_MAX,
  POST_BODY_MAX,
  POSTS_BUCKET,
  type CommunityError,
  type CommunityViewer,
  type PostKind,
  cleanBody,
  isOwnPostPath,
  isUuid,
  tasteFromRows,
} from '@/lib/community'

function enrichLater(work: () => Promise<void>) {
  const run = () => { void work().catch((error) => console.error('community enrich', error)) }
  try { after(run) } catch { run() }
}

// Writes for Comunidad. The feed itself is the CDN endpoint (app/api/comunidad);
// these run only when someone acts, after the session is checked. Error codes,
// not sentences: the client shows them in the reader's language.
// `official` and `pinned_until` are never set here. An admin posting as the
// Mundial uses the admin action.

const emptyViewer = (): CommunityViewer => ({
  signedIn: false,
  canPost: false,
  liked: [],
  mine: [],
  artworkPostId: null,
  unpostedArtworkSlug: null,
  taste: {},
})

function configured() {
  return isSupabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function sessionUser(): Promise<User | null> {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  return user
}

function fromDb(error: { code?: string; message?: string } | null): CommunityError | null {
  if (!error) return null
  if (error.code === '23505') return 'already'
  if (error.code === 'P0001' || /rate_limited/.test(error.message ?? '')) return 'rate_limited'
  return 'unavailable'
}

type ProfileRow = { onboarded_at: string | null; is_public: boolean | null }

async function canPost(userId: string): Promise<boolean | null> {
  const { data, error } = await createAdminClient()
    .from('profiles')
    .select('onboarded_at, is_public')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  const profile = data as ProfileRow | null
  return Boolean(profile?.onboarded_at && profile.is_public)
}

export async function communityViewer(input: { postIds?: string[]; artworkSlug?: string } = {}): Promise<CommunityViewer> {
  if (!configured()) return emptyViewer()
  try {
    const user = await sessionUser()
    if (!user) return emptyViewer()
    const admin = createAdminClient()
    // One request for the profile and one for the taste: the taste is computed
    // by the database from likes, comments, saved obras and gallery attention
    // (docs/red-social-explorar.md). It stays empty until there is enough to
    // read, and the feed ranks with it in the browser, never on the server.
    const [profileResult, tasteResult] = await Promise.all([
      admin.from('profiles').select('onboarded_at, is_public').eq('id', user.id).maybeSingle(),
      admin.rpc('community_taste', { visitor: user.id }),
    ])
    const taste = tasteResult.error
      ? {}
      : tasteFromRows((tasteResult.data ?? []) as { tag: string; weight: number }[])
    const { data, error } = profileResult
    if (error) return { ...emptyViewer(), signedIn: true, taste }
    const profile = data as ProfileRow | null
    const artist = Boolean(profile?.onboarded_at && profile.is_public)
    const postIds = [...new Set((input.postIds ?? []).filter(isUuid))].slice(0, 50)

    const [likedRows, mineRows] = postIds.length
      ? await Promise.all([
          admin.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          admin.from('posts').select('id').eq('profile_id', user.id).in('id', postIds).neq('status', 'removed'),
        ])
      : [null, null]
    if (likedRows?.error || mineRows?.error) return { ...emptyViewer(), signedIn: true, canPost: artist, taste }

    let artworkPostId: string | null = null
    if (input.artworkSlug) {
      const artwork = await admin.from('artworks').select('id').eq('slug', input.artworkSlug).maybeSingle()
      const artworkId = (artwork.data as { id: string } | null)?.id
      if (artworkId) {
        const existing = await admin.from('posts').select('id').eq('artwork_id', artworkId).eq('kind', 'artwork').neq('status', 'removed').maybeSingle()
        artworkPostId = (existing.data as { id: string } | null)?.id ?? null
      }
    }

    let unpostedArtworkSlug: string | null = null
    if (artist) {
      const selected = await admin
        .from('artworks')
        .select('id, slug')
        .eq('profile_id', user.id)
        .eq('is_selected', true)
        .is('archived_at', null)
        .eq('is_club_only', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const obra = selected.data as { id: string; slug: string } | null
      if (obra) {
        const posted = await admin.from('posts').select('id').eq('artwork_id', obra.id).eq('kind', 'artwork').neq('status', 'removed').maybeSingle()
        if (!posted.data) unpostedArtworkSlug = obra.slug
      }
    }

    return {
      signedIn: true,
      canPost: artist,
      liked: ((likedRows?.data ?? []) as { post_id: string }[]).map((row) => row.post_id),
      mine: ((mineRows?.data ?? []) as { id: string }[]).map((row) => row.id),
      artworkPostId,
      unpostedArtworkSlug,
      taste,
    }
  } catch {
    return emptyViewer()
  }
}

export async function publishArtwork(input: { artworkSlug: string; body?: string }): Promise<{ ok: true; id: string } | { error: CommunityError }> {
  if (!configured()) return { error: 'unavailable' }
  const body = cleanBody(input?.body, POST_BODY_MAX)
  if (body == null) return { error: 'too_long' }
  if (!input?.artworkSlug || typeof input.artworkSlug !== 'string') return { error: 'not_found' }
  try {
    const user = await sessionUser()
    if (!user) return { error: 'signin' }
    const artist = await canPost(user.id)
    if (artist == null) return { error: 'unavailable' }
    if (!artist) return { error: 'not_artist' }

    const admin = createAdminClient()
    const artwork = await admin
      .from('artworks')
      .select('id')
      .eq('slug', input.artworkSlug)
      .eq('profile_id', user.id)
      .eq('is_selected', true)
      .is('archived_at', null)
      .eq('is_club_only', false)
      .maybeSingle()
    const artworkId = (artwork.data as { id: string } | null)?.id
    if (artwork.error || !artworkId) return { error: artwork.error ? 'unavailable' : 'not_found' }

    const { data, error } = await admin
      .from('posts')
      .insert({ profile_id: user.id, kind: 'artwork', artwork_id: artworkId, body, status: 'published' })
      .select('id')
      .single()
    const failure = fromDb(error)
    if (failure || !data) return { error: failure ?? 'unavailable' }
    const id = (data as { id: string }).id
    enrichLater(() => enrichCommunityPost(id))
    return { ok: true, id }
  } catch {
    return { error: 'unavailable' }
  }
}

// Souvenirs go up at once; a free photo waits for /admin/publicaciones.
// The browser has already uploaded the file into the caller's own folder.
export async function publishImage(input: { kind: 'souvenir' | 'photo'; path: string; body?: string }): Promise<{ ok: true; id: string; pending: boolean } | { error: CommunityError }> {
  if (!configured()) return { error: 'unavailable' }
  const body = cleanBody(input?.body, POST_BODY_MAX)
  if (body == null) return { error: 'too_long' }
  if (input?.kind !== 'souvenir' && input?.kind !== 'photo') return { error: 'bad_image' }
  try {
    const user = await sessionUser()
    if (!user) return { error: 'signin' }
    if (!isOwnPostPath(input.path, user.id)) return { error: 'bad_image' }
    const artist = await canPost(user.id)
    if (artist == null) return { error: 'unavailable' }
    if (!artist) return { error: 'not_artist' }

    const admin = createAdminClient()
    const name = input.path.split('/')[1]
    const { data: files, error: listError } = await admin.storage.from(POSTS_BUCKET).list(user.id, { search: name })
    if (listError || !files?.some((file) => file.name === name)) return { error: 'bad_image' }

    const pending = input.kind === 'photo'
    const { data, error } = await admin
      .from('posts')
      .insert({
        profile_id: user.id,
        kind: input.kind satisfies PostKind,
        image_path: input.path,
        body,
        status: pending ? 'pending' : 'published',
      })
      .select('id')
      .single()
    const failure = fromDb(error)
    if (failure || !data) {
      await admin.storage.from(POSTS_BUCKET).remove([input.path])
      return { error: failure ?? 'unavailable' }
    }
    const id = (data as { id: string }).id
    enrichLater(() => enrichCommunityPost(id))
    return { ok: true, id, pending }
  } catch {
    return { error: 'unavailable' }
  }
}

export async function deletePost(id: string): Promise<{ ok: true } | { error: CommunityError }> {
  if (!configured()) return { error: 'unavailable' }
  if (!isUuid(id)) return { error: 'not_found' }
  try {
    const user = await sessionUser()
    if (!user) return { error: 'signin' }
    const admin = createAdminClient()
    const { data, error } = await admin.from('posts').select('id, profile_id, image_path, status').eq('id', id).maybeSingle()
    const post = data as { id: string; profile_id: string; image_path: string | null; status: string } | null
    if (error) return { error: 'unavailable' }
    if (!post || post.profile_id !== user.id) return { error: 'not_found' }
    if (post.status !== 'removed') {
      const { error: updateError } = await admin.from('posts').update({ status: 'removed' }).eq('id', id).eq('profile_id', user.id)
      if (updateError) return { error: 'unavailable' }
      if (post.image_path) await admin.storage.from(POSTS_BUCKET).remove([post.image_path])
    }
    return { ok: true }
  } catch {
    return { error: 'unavailable' }
  }
}

export type PostComment = {
  id: string
  name: string
  body: string
  createdAt: string
  pending: boolean
  mine: boolean
}

export async function listPostComments(postId: string): Promise<{ ok: true; comments: PostComment[] } | { error: CommunityError }> {
  if (!configured()) return { error: 'unavailable' }
  if (!isUuid(postId)) return { error: 'not_found' }
  try {
    const user = await sessionUser()
    const admin = createAdminClient()
    const post = await admin.from('posts').select('status').eq('id', postId).maybeSingle()
    if (post.error) return { error: 'unavailable' }
    if (!post.data || (post.data as { status: string }).status === 'removed') return { error: 'not_found' }
    const { data, error } = await admin
      .from('post_comments')
      .select('id, user_id, author_name, body, created_at, status')
      .eq('post_id', postId)
      .in('status', ['approved', 'pending'])
      .order('created_at', { ascending: true })
    if (error) return { error: 'unavailable' }
    const comments = ((data ?? []) as { id: string; user_id: string; author_name: string; body: string; created_at: string; status: string }[])
      .filter((row) => row.status === 'approved' || row.user_id === user?.id)
      .map((row) => ({
        id: row.id,
        name: row.author_name,
        body: row.body,
        createdAt: row.created_at,
        pending: row.status === 'pending',
        mine: row.user_id === user?.id,
      }))
    return { ok: true, comments }
  } catch {
    return { error: 'unavailable' }
  }
}

export async function addPostComment(input: { postId: string; body: string }): Promise<{ ok: true; id: string; pending: boolean } | { error: CommunityError }> {
  if (!configured()) return { error: 'unavailable' }
  const body = cleanBody(input?.body, COMMENT_BODY_MAX)
  if (body == null) return { error: 'too_long' }
  if (!body) return { error: 'too_long' }
  if (!isUuid(input.postId)) return { error: 'not_found' }
  try {
    const user = await sessionUser()
    if (!user) return { error: 'signin' }
    const admin = createAdminClient()
    const post = await admin.from('posts').select('status').eq('id', input.postId).maybeSingle()
    if (post.error) return { error: 'unavailable' }
    if (!post.data || (post.data as { status: string }).status !== 'published') return { error: 'not_found' }
    const artist = await canPost(user.id)
    if (artist == null) return { error: 'unavailable' }
    const pending = !artist
    const { data, error } = await admin.from('post_comments').insert({
      post_id: input.postId,
      user_id: user.id,
      author_name: await authorName(user),
      author_email: user.email?.toLowerCase() ?? null,
      body,
      status: pending ? 'pending' : 'approved',
    }).select('id').single()
    const failure = fromDb(error)
    if (failure || !data) return { error: failure === 'already' ? 'unavailable' : failure ?? 'unavailable' }
    const id = (data as { id: string }).id
    enrichLater(() => enrichCommunityComment(id))
    return { ok: true, id, pending }
  } catch {
    return { error: 'unavailable' }
  }
}

const REPORT_REASON_MAX = 300

export async function reportPost(input: { postId: string; reason?: string }): Promise<{ ok: true } | { error: CommunityError }> {
  if (!configured()) return { error: 'unavailable' }
  if (!input || !isUuid(input.postId)) return { error: 'not_found' }
  const reason = cleanBody(input.reason ?? '', REPORT_REASON_MAX)
  if (reason == null) return { error: 'too_long' }
  try {
    const user = await sessionUser()
    if (!user) return { error: 'signin' }
    const admin = createAdminClient()
    const post = await admin.from('posts').select('status, kind, artwork_id').eq('id', input.postId).maybeSingle()
    if (post.error) return { error: 'unavailable' }
    const row = post.data as { status: string; kind: string; artwork_id: string | null } | null
    // An obra is the artist's contest work. Souvenirs and free photos can still be reported.
    if (!row || row.status !== 'published' || row.kind === 'artwork' || row.artwork_id) return { error: 'not_found' }
    const { error } = await admin.from('post_reports').insert({ post_id: input.postId, user_id: user.id, reason })
    // One report per person: a repeat is the same as the first.
    if (error && error.code !== '23505') return fromDb(error) === 'rate_limited' ? { error: 'rate_limited' } : { error: 'unavailable' }
    return { ok: true }
  } catch {
    return { error: 'unavailable' }
  }
}

export async function togglePostLike(id: string): Promise<{ ok: true; liked: boolean; likes: number } | { error: CommunityError }> {
  if (!configured()) return { error: 'unavailable' }
  if (!isUuid(id)) return { error: 'not_found' }
  try {
    const user = await sessionUser()
    if (!user) return { error: 'signin' }
    const admin = createAdminClient()
    const post = await admin.from('posts').select('id, status').eq('id', id).maybeSingle()
    const row = post.data as { id: string; status: string } | null
    if (post.error) return { error: 'unavailable' }
    if (!row || row.status !== 'published') return { error: 'not_found' }

    const existing = await admin.from('post_likes').select('post_id').eq('post_id', id).eq('user_id', user.id).maybeSingle()
    if (existing.error) return { error: 'unavailable' }
    const liked = !existing.data
    const write = liked
      ? await admin.from('post_likes').insert({ post_id: id, user_id: user.id })
      : await admin.from('post_likes').delete().eq('post_id', id).eq('user_id', user.id)
    const failure = fromDb(write.error)
    // A duplicate insert means it was already liked: report the current count.
    if (failure && failure !== 'already') return { error: failure }
    const fresh = await admin.from('posts').select('like_count').eq('id', id).maybeSingle()
    const likes = (fresh.data as { like_count: number } | null)?.like_count
    if (fresh.error || likes == null) return { error: 'unavailable' }
    return { ok: true, liked: failure === 'already' ? true : liked, likes }
  } catch {
    return { error: 'unavailable' }
  }
}
