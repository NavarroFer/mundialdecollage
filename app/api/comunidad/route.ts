import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import {
  ERROR_CACHE,
  FEED_CACHE,
  INVALID_CACHE,
  type FeedPage,
  encodeCursor,
  parseFeedQuery,
} from '@/lib/community'
import { toFeedPost, type FeedRow } from '@/lib/community-server'

// The public feed. Same bytes for every visitor, so the CDN keeps them
// (Cache-Control below). It does not read the session, cookies or headers:
// anything personal goes through communityViewer(), a server action.
// No `revalidate`: an ISR write per refresh would burn the Hobby quota.

const unavailable = () => NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': ERROR_CACHE } })
const invalid = () => NextResponse.json({ error: 'invalid' }, { status: 400, headers: { 'Cache-Control': INVALID_CACHE } })

function configured() {
  return isSupabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET(request: Request) {
  const query = parseFeedQuery(new URL(request.url).searchParams)
  if (!query) return invalid()
  if (!configured()) return unavailable()

  try {
    const admin = createAdminClient()
    const publicUrl = (path: string) => admin.storage.from('posts').getPublicUrl(path).data.publicUrl
    const { data, error } = query.highlights
      ? await admin.rpc('community_highlights', { page_size: query.limit })
      : await admin.rpc('community_feed', {
          before_at: query.cursor?.at ?? null,
          before_id: query.cursor?.id ?? null,
          author: query.author,
          page_size: query.limit + 1,
        })
    if (error || !Array.isArray(data)) return unavailable()

    const rows = data as FeedRow[]
    const pageRows = query.highlights ? rows : rows.slice(0, query.limit)
    const posts = pageRows.flatMap((row) => {
      const post = toFeedPost(row, query.lang, publicUrl)
      return post ? [post] : []
    })
    const last = pageRows[pageRows.length - 1]
    const page: FeedPage = {
      posts,
      next: !query.highlights && rows.length > query.limit && last
        ? encodeCursor(last.created_at, last.id)
        : null,
    }
    return NextResponse.json(page, { headers: { 'Cache-Control': FEED_CACHE } })
  } catch {
    return unavailable()
  }
}
