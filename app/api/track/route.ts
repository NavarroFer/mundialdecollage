import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { VISITOR_ID_PATTERN, isFunnelEvent } from '@/lib/funnel'
import { recordFunnelEvent } from '@/lib/track-server'

// Receives the circuit steps the browser reports (lib/track.ts). Only known
// step names and well-formed anonymous ids get in; the account is attached
// from the session, never from the request body.
export async function POST(request: NextRequest) {
  let payload: { name?: unknown; vid?: unknown }
  try {
    payload = await request.json()
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  if (!isFunnelEvent(payload?.name) || typeof payload.vid !== 'string' || !VISITOR_ID_PATTERN.test(payload.vid)) return new NextResponse(null, { status: 400 })

  let userId: string | null = null
  // Anonymous events need no Supabase Auth call. Signed-in events still
  // verify the session server-side; never trust a user id from the payload.
  const hasSession = request.cookies.getAll().some(({ name }) => name.startsWith('sb-'))
  if (isSupabaseConfigured && hasSession) {
    const { data: { user } } = await (await createClient()).auth.getUser()
    userId = user?.id ?? null
  }
  await recordFunnelEvent(payload.name, payload.vid, userId)
  return new NextResponse(null, { status: 204 })
}
