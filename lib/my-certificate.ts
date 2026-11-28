import { cache } from 'react'
import { getCallState } from '@/lib/call-state'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isAdminView } from '@/lib/view-mode'

// The obra whose participation certificate the signed-in artist can open at
// /mi-certificado, or null: nobody signed in, an admin seen as one, the call
// still open, or no obra that takes part (the same rule as
// certificate_recipients(), the list the certificate mail goes to). Read once
// per request: the header, the account menu and the home all ask.
export const getMyCertificateSlug = cache(async (): Promise<string | null> => {
  if (!isSupabaseConfigured) return null
  const user = await getCurrentUser()
  if (!user || (await isAdminView(user))) return null
  if ((await getCallState()).open) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('artworks')
    .select('slug')
    .eq('profile_id', user.id)
    .eq('is_selected', true)
    .is('archived_at', null)
    .not('slug', 'is', null)
    .not('image_url', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.slug ?? null
})

export const MY_CERTIFICATE_PATH = '/mi-certificado'
