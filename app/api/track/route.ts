import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { TRACK_BATCH_MAX, VISITOR_ID_PATTERN, isFunnelEvent } from '@/lib/funnel'
import { recordFunnelEvents } from '@/lib/track-server'
import type { InAppBrowser } from '@/lib/in-app-browser'

// Receives the circuit steps the browser reports (lib/track.ts), a batch at
// a time — or one `name`, from a tab opened before batches existed. Only
// known step names and well-formed anonymous ids get in; the account is
// attached from the session, never from the request body.
export async function POST(request: NextRequest) {
  let payload: { name?: unknown; names?: unknown; vid?: unknown; inApp?: unknown }
  try {
    payload = await request.json()
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  const names: unknown[] = Array.isArray(payload?.names) ? payload.names : [payload?.name]
  if (!names.length || names.length > TRACK_BATCH_MAX || !names.every(isFunnelEvent)) return new NextResponse(null, { status: 400 })
  if (typeof payload.vid !== 'string' || !VISITOR_ID_PATTERN.test(payload.vid)) return new NextResponse(null, { status: 400 })

  let userId: string | null = null
  // Anonymous events need no Supabase Auth call. Signed-in events still
  // verify the session server-side; never trust a user id from the payload.
  const hasSession = request.cookies.getAll().some(({ name }) => name.startsWith('sb-'))
  if (isSupabaseConfigured && hasSession) {
    const { data: { user } } = await (await createClient()).auth.getUser()
    userId = user?.id ?? null
  }
  // Which app's browser sent them (lib/in-app-browser.ts); anything else is none.
  const inApp: InAppBrowser | null = payload.inApp === 'instagram' || payload.inApp === 'facebook' ? payload.inApp : null
  await recordFunnelEvents(names, payload.vid, userId, inApp)
  return new NextResponse(null, { status: 204 })
}
