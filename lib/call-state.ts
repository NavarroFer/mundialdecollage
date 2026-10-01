// Whether the 1st edition's call is still taking obras (public.call_state),
// closed by hand from /admin/convocatoria. Read once per request: the home,
// the header, /onboarding and the server actions all ask.
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export type CallState = { open: boolean; closedAt: string | null }

export const getCallState = cache(async (): Promise<CallState> => {
  if (!isSupabaseConfigured) return { open: true, closedAt: null }
  const { data, error } = await createPublicClient().from('call_state').select('closed_at').eq('id', true).maybeSingle()
  // Can't tell (e.g. the migration hasn't run yet): stay open rather than
  // turning artists away by mistake.
  if (error || !data) return { open: true, closedAt: null }
  return { open: !data.closed_at, closedAt: data.closed_at }
})

export async function isCallOpen() {
  return (await getCallState()).open
}
