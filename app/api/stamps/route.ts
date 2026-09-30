import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isStampKey, STAMP_KEYS } from '@/lib/stamps'

const VISIT_STAMPS = new Set(['gallery', 'world'])

export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ signedIn: false, unlockedStamps: [] })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ signedIn: false, unlockedStamps: [] })
  const { data, error } = await supabase.from('profile_stamps').select('stamp_key')
  if (error) return new NextResponse(null, { status: 500 })
  return NextResponse.json({
    signedIn: true,
    unlockedStamps: (data ?? []).flatMap((row) => isStampKey(row.stamp_key) ? [row.stamp_key] : []),
  })
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return new NextResponse(null, { status: 204 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.stamp !== 'string' || !isStampKey(body.stamp) || !VISIT_STAMPS.has(body.stamp)) return new NextResponse(null, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse(null, { status: 401 })
  const { data: existing, error: readError } = await supabase.from('profile_stamps').select('stamp_key').eq('stamp_key', body.stamp).maybeSingle()
  if (readError) return new NextResponse(null, { status: 500 })
  if (existing) return NextResponse.json({ awarded: false })
  const { error } = await supabase.from('profile_stamps').insert({ profile_id: user.id, stamp_key: body.stamp })
  return error ? new NextResponse(null, { status: 500 }) : NextResponse.json({ awarded: true, stamp: body.stamp })
}
