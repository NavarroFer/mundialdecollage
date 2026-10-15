import { ADMIN_EMAILS } from '@/lib/admin'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from '@/lib/supabase/server'
import { TermsPrompt } from './terms-prompt'

/**
 * The Términos y Condiciones prompt for whoever is signed in; nothing for
 * visitors without a session (the anonymous copies stay static). Admins
 * write the terms, they don't accept them.
 */
export async function TermsPromptSlot() {
  if (!isSupabaseConfigured) return null
  const user = await getCurrentUser()
  if (!user || ADMIN_EMAILS.includes(user.email ?? '')) return null
  return <TermsPrompt userId={user.id} />
}
