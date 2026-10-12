// Server side of the circuit measurement, for steps that only the server
// sees (a finished sign-up). Uses the same anonymous cookie the browser set;
// never throws — measuring must not break the action it's measuring.
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { VISITOR_COOKIE, VISITOR_ID_PATTERN, type FunnelEvent } from '@/lib/funnel'
import { inAppBrowser, type InAppBrowser } from '@/lib/in-app-browser'
import { isVisitSource, VISIT_SOURCE_COOKIE } from '@/lib/visit-source'

// One row per step, in a single insert: the browser sends its steps in
// batches (lib/track.ts).
export async function recordFunnelEvents(names: FunnelEvent[], visitorId: string | undefined, userId: string | null, inApp: InAppBrowser | null = null) {
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  if (!names.length || !visitorId || !VISITOR_ID_PATTERN.test(visitorId)) return
  try {
    const rows = names.map((name) => ({ name, visitor_id: visitorId, user_id: userId, in_app: inApp }))
    const db = createAdminClient()
    let { error } = await db.from('funnel_events').insert(rows)
    // A deploy can go live minutes before its migration adds in_app: keep
    // the steps rather than lose them over the missing column.
    if (error && /in_app/.test(error.message)) ({ error } = await db.from('funnel_events').insert(rows.map(({ in_app: _, ...row }) => row)))
    if (error) console.error('funnel event failed', names.join(','), error.message)
  } catch (error) {
    console.error('funnel event failed', names.join(','), error)
  }
}

export async function recordFunnelEvent(name: FunnelEvent, visitorId: string | undefined, userId: string | null, inApp: InAppBrowser | null = null) {
  await recordFunnelEvents([name], visitorId, userId, inApp)
}

export async function trackServer(name: FunnelEvent, userId: string | null) {
  try {
    const inApp = inAppBrowser((await headers()).get('user-agent'))
    await recordFunnelEvent(name, (await cookies()).get(VISITOR_COOKIE)?.value, userId, inApp)
  } catch {}
}

// A finished sign-up, by where its artist first came from: the cookie
// lib/track.ts set on their first page (lib/visit-source.ts), or the
// artist whose invitation was just credited. Without either (a first visit
// from before the cookie existed) nothing is recorded rather than a guess:
// the gap to signup_done is the unknown share.
export async function trackSignupSource(userId: string, referred: boolean) {
  try {
    const cookie = (await cookies()).get(VISIT_SOURCE_COOKIE)?.value
    const source = referred ? 'artist' : isVisitSource(cookie) ? cookie : null
    if (source) await trackServer(`signup_source_${source}`, userId)
  } catch {}
}
