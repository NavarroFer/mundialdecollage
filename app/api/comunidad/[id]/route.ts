import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { ERROR_CACHE, FEED_CACHE, INVALID_CACHE, isUuid } from '@/lib/community'
import { toFeedPost, type FeedRow } from '@/lib/community-server'

// One published post, for a link that landed past the first page
// (`/comunidad#post-<id>`). Hidden and removed posts are not found.
// Same cache as the feed: nothing here depends on who's asking.

const unavailable = () => NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': ERROR_CACHE } })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'invalid' }, { status: 400, headers: { 'Cache-Control': INVALID_CACHE } })
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return unavailable()

  const lang = new URL(request.url).searchParams.get('lang')
  const asked = lang && /^[a-z]{2}$/.test(lang) ? lang : 'es'

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('community_post', { post: id })
    if (error) return unavailable()
    const row = (Array.isArray(data) ? data[0] : data) as FeedRow | null
    const publicUrl = (path: string) => admin.storage.from('posts').getPublicUrl(path).data.publicUrl
    const post = row ? toFeedPost(row, asked, publicUrl) : null
    if (!post) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': FEED_CACHE } })
    return NextResponse.json(post, { headers: { 'Cache-Control': FEED_CACHE } })
  } catch {
    return unavailable()
  }
}
