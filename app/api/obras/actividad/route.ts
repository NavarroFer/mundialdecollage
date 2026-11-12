import { NextResponse } from 'next/server'
import { tagIndexes } from '@/lib/community-tags'
import { viewerCanSeeObraFeed } from '@/lib/feed-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/community'

// Participating artists only. The list is the same for all of them, but it
// is not a public CDN response: a visitor or a signed-in non-participant
// must not be able to read it. The anonymous home never calls this.

const PRIVATE = 'private, no-store'

type Row = {
  id: string
  slug: string
  title: string | null
  image_url: string
  author_name: string
  author_country: string | null
  like_count: number
  comment_count: number
  last_activity_at: string
  recent: { author: string; body: string; createdAt: string }[] | null
  tags: string[] | null
  author_id: string
}

export async function GET(request: Request) {
  if (!(await viewerCanSeeObraFeed())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: { 'Cache-Control': PRIVATE } })
  }
  const params = new URL(request.url).searchParams
  const beforeAt = params.get('antes')
  const beforeId = params.get('id')
  if ((beforeAt && Number.isNaN(Date.parse(beforeAt))) || (beforeId && !isUuid(beforeId)) || Boolean(beforeAt) !== Boolean(beforeId)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers: { 'Cache-Control': PRIVATE } })
  }
  try {
    const { data, error } = await createAdminClient().rpc('obra_activity_feed', {
      before_at: beforeAt,
      before_id: beforeId,
      page_size: 11,
    })
    if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': PRIVATE } })
    const rows = (data ?? []) as Row[]
    const page = rows.slice(0, 10)
    const more = rows[10]
    return NextResponse.json({
      obras: page.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        imageUrl: row.image_url,
        authorId: row.author_id,
        authorName: row.author_name,
        countryCode: row.author_country,
        likes: row.like_count,
        comments: row.comment_count,
        activityAt: row.last_activity_at,
        recent: row.recent ?? [],
        tags: tagIndexes(row.tags),
      })),
      next: more ? { at: more.last_activity_at, id: more.id } : null,
    }, { headers: { 'Cache-Control': PRIVATE } })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': PRIVATE } })
  }
}
