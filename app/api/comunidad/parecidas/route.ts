import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isUuid, type SimilarObra } from '@/lib/community'
import { toFeedPost, type FeedRow } from '@/lib/community-server'

// Similar posts for everyone, so the CDN can keep the answer for a day.
// No session. Tags come from the one-time description (lib/community-ai.ts).

const CACHE = 'public, s-maxage=86400, stale-while-revalidate=604800'
const NO_STORE = 'no-store'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const postId = params.get('id')
  const obra = params.get('obra')
  const slug = params.get('slug')
  if ((postId && !isUuid(postId)) || (obra && !isUuid(obra)) || (!postId && !obra && !slug)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'public, s-maxage=3600' } })
  }
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ posts: [] }, { headers: { 'Cache-Control': NO_STORE } })
  }
  try {
    const admin = createAdminClient()
    // An obra (by slug or id) gets published obras that share its tags; a post
    // gets posts. Both are the same for everyone.
    if (!postId) {
      const query = admin.from('artworks').select('slug, tags')
      const { data: found } = await (obra ? query.eq('id', obra) : query.eq('slug', slug!)).maybeSingle()
      const source = found as { slug: string | null; tags: string[] | null } | null
      const tags = source?.tags ?? []
      const { data, error } = await admin.rpc('obra_similar', { match_tags: tags, skip_slug: source?.slug ?? null, page_size: 6 })
      if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': NO_STORE } })
      const obras: SimilarObra[] = ((data ?? []) as { slug: string; title: string | null; image_url: string; author_name: string | null }[])
        .map((row) => ({ slug: row.slug, title: row.title ?? '', imageUrl: row.image_url, author: row.author_name ?? '' }))
      return NextResponse.json({ obras }, { headers: { 'Cache-Control': CACHE } })
    }
    const { data: source } = await admin.from('posts').select('tags').eq('id', postId).maybeSingle()
    const tags = ((source as { tags: string[] | null } | null)?.tags) ?? []
    const { data, error } = await admin.rpc('community_similar', { match_tags: tags, skip: postId, page_size: 6 })
    if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': NO_STORE } })
    const publicUrl = (path: string) => admin.storage.from('posts').getPublicUrl(path).data.publicUrl
    const posts = ((data ?? []) as FeedRow[]).flatMap((row) => {
      const post = toFeedPost(row, 'es', publicUrl)
      return post ? [post] : []
    })
    return NextResponse.json({ posts }, { headers: { 'Cache-Control': CACHE } })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': NO_STORE } })
  }
}
