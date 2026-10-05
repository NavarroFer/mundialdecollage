'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { trackServer } from '@/lib/track-server'
import { WAITLIST_SOURCES, type WaitlistSource } from '@/lib/waitlist'

// «Avisame»: a visitor who isn't an artist leaves their email to hear about
// the finalists and the magazine. It lands in the same `contacts` list the
// campaigns go to (/admin/contactos), tagged aviso_<where>. Error codes, not
// sentences: the form shows them in the reader's language.
export type WaitlistState = 'idle' | 'done' | 'invalid' | 'unavailable'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function joinWaitlist(source: WaitlistSource, _previous: WaitlistState, formData: FormData): Promise<WaitlistState> {
  if (!(WAITLIST_SOURCES as readonly string[]).includes(source)) return 'invalid'
  // Honeypot: hidden from people, filled in by bots. Pretend it worked.
  if (formData.get('website')) return 'done'
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 'unavailable'

  const { data: { user } } = await (await createClient()).auth.getUser()
  // Signed in (e.g. right after a like in the gallery): one tap, with the
  // account's own email — nothing typed means nothing to get wrong.
  const typed = formData.get('email')
  const email = (typeof typed === 'string' && typed.trim() ? typed : user?.email ?? '').trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return 'invalid'
  const name = typeof user?.user_metadata?.full_name === 'string' && email === user.email?.toLowerCase()
    ? user.user_metadata.full_name
    : null

  const db = createAdminClient()
  const { data: existing, error: lookupError } = await db.from('contacts').select('id, subscribed').eq('email', email).maybeSingle()
  if (lookupError) {
    console.error('joinWaitlist lookup failed', lookupError.message)
    return 'unavailable'
  }
  // Already on the list: keep its original source, but asking again is an
  // explicit opt-in, so someone who had unsubscribed is back in.
  const { error } = existing
    ? existing.subscribed ? { error: null } : await db.from('contacts').update({ subscribed: true }).eq('id', existing.id)
    : await db.from('contacts').insert({ email, name, source: `aviso_${source}` })
  if (error) {
    console.error('joinWaitlist save failed', error.message)
    return 'unavailable'
  }

  await trackServer(`waitlist_signup_${source}`, user?.id ?? null)
  return 'done'
}
