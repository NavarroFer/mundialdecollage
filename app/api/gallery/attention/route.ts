import { NextRequest, NextResponse } from 'next/server'
import { parseAttentionBatch } from '@/lib/gallery-attention'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return new NextResponse(null, { status: 403 })
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new NextResponse(null, { status: 503 })
  // Bound the actual stream, not just an optional/forgeable Content-Length.
  const reader = request.body?.getReader()
  if (!reader) return new NextResponse(null, { status: 400 })
  let raw = ''
  let bytes = 0
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 24_000) { await reader.cancel(); return new NextResponse(null, { status: 413 }) }
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
    const batch = parseAttentionBatch(JSON.parse(raw))
    if (!batch) return new NextResponse(null, { status: 400 })
    const { data: { user }, error } = await (await createClient()).auth.getUser()
    if (error || !user) return new NextResponse(null, { status: 401 })
    // This is a consistency guard, never the source of database attribution.
    if (batch.accountId !== user.id) return new NextResponse(null, { status: 403 })
    // Development uses the production Supabase project: don't pollute it.
    if (process.env.NODE_ENV !== 'production') return new NextResponse(null, { status: 204 })
    const { error: saveError } = await createAdminClient().rpc('record_gallery_attention', {
      viewer_id: user.id, visit_id: batch.sessionId, samples: batch.rows,
    })
    if (saveError) {
      console.error('gallery attention save failed', saveError.code)
      return new NextResponse(null, { status: 503 })
    }
    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 400 })
  }
}
