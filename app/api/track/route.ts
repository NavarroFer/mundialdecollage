import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isFunnelEvent } from '@/lib/funnel'
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
  if (!isFunnelEvent(payload?.name) || typeof payload.vid !== 'string') return new NextResponse(null, { status: 400 })

  let userId: string | null = null
  if (isSupabaseConfigured) {
    const { data: { user } } = await (await createClient()).auth.getUser()
    userId = user?.id ?? null
  }
  await recordFunnelEvent(payload.name, payload.vid, userId)
  return new NextResponse(null, { status: 204 })
}
