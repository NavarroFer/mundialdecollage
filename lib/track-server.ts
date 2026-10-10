// Server side of the circuit measurement, for steps that only the server
// sees (a finished sign-up). Uses the same anonymous cookie the browser set;
// never throws — measuring must not break the action it's measuring.
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { VISITOR_COOKIE, VISITOR_ID_PATTERN, type FunnelEvent } from '@/lib/funnel'

// One row per step, in a single insert: the browser sends its steps in
// batches (lib/track.ts).
export async function recordFunnelEvents(names: FunnelEvent[], visitorId: string | undefined, userId: string | null) {
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  if (!names.length || !visitorId || !VISITOR_ID_PATTERN.test(visitorId)) return
  try {
    const { error } = await createAdminClient().from('funnel_events').insert(names.map((name) => ({ name, visitor_id: visitorId, user_id: userId })))
    if (error) console.error('funnel event failed', names.join(','), error.message)
  } catch (error) {
    console.error('funnel event failed', names.join(','), error)
  }
}

export async function recordFunnelEvent(name: FunnelEvent, visitorId: string | undefined, userId: string | null) {
  await recordFunnelEvents([name], visitorId, userId)
}

export async function trackServer(name: FunnelEvent, userId: string | null) {
  try {
    await recordFunnelEvent(name, (await cookies()).get(VISITOR_COOKIE)?.value, userId)
  } catch {}
}
