import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// Live Comunidad numbers for /admin/estadisticas. No fixed counts: every
// figure is counted here. Goals live next to them in the panel (§11.1).

export type CommunityStats = {
  activeWeek: number
  artists: number
  postedArtists: number
  posts: number
  byKind: { kind: string; count: number }[]
  withResponse: number
  repeatArtists: number
  avgLikes: number
  avgComments: number
}

const PAGE = 1000

export async function loadCommunityStats(): Promise<CommunityStats | null> {
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  try {
    const admin = createAdminClient()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const posts: { profile_id: string; kind: string; status: string; like_count: number; comment_count: number; created_at: string }[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from('posts').select('profile_id, kind, status, like_count, comment_count, created_at').neq('status', 'removed').order('id').range(from, from + PAGE - 1)
      if (error) return null
      posts.push(...(data ?? []))
      if ((data?.length ?? 0) < PAGE) break
    }
    const { count: artists } = await admin.from('profiles').select('id', { count: 'exact', head: true }).not('onboarded_at', 'is', null).eq('is_public', true)
    const likes = await admin.from('post_likes').select('user_id').gte('created_at', since)
    const comments = await admin.from('post_comments').select('user_id').gte('created_at', since)
    if (likes.error || comments.error) return null

    const published = posts.filter((post) => post.status === 'published')
    const byAuthor = new Map<string, number>()
    const byKind = new Map<string, number>()
    for (const post of published) {
      byAuthor.set(post.profile_id, (byAuthor.get(post.profile_id) ?? 0) + 1)
      byKind.set(post.kind, (byKind.get(post.kind) ?? 0) + 1)
    }
    const active = new Set<string>([
      ...posts.filter((post) => post.created_at >= since).map((post) => post.profile_id),
      ...(likes.data ?? []).map((row) => row.user_id),
      ...(comments.data ?? []).map((row) => row.user_id),
    ])
    const likesTotal = published.reduce((sum, post) => sum + post.like_count, 0)
    const commentsTotal = published.reduce((sum, post) => sum + post.comment_count, 0)
    return {
      activeWeek: active.size,
      artists: artists ?? 0,
      postedArtists: byAuthor.size,
      posts: published.length,
      byKind: [...byKind.entries()].map(([kind, count]) => ({ kind, count })),
      withResponse: published.filter((post) => post.like_count + post.comment_count > 0).length,
      repeatArtists: [...byAuthor.values()].filter((count) => count >= 2).length,
      avgLikes: published.length ? likesTotal / published.length : 0,
      avgComments: published.length ? commentsTotal / published.length : 0,
    }
  } catch {
    return null
  }
}
