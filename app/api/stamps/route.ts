import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const VISIT_STAMPS = new Set(['gallery', 'world'])

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return new NextResponse(null, { status: 204 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.stamp !== 'string' || !VISIT_STAMPS.has(body.stamp)) return new NextResponse(null, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse(null, { status: 401 })
  const { error } = await supabase.from('profile_stamps').upsert({ profile_id: user.id, stamp_key: body.stamp }, { onConflict: 'profile_id,stamp_key', ignoreDuplicates: true })
  return error ? new NextResponse(null, { status: 500 }) : new NextResponse(null, { status: 204 })
}
