import { canSeeObraFeed } from '@/lib/artist-home'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { isAdminEmail, isAdminView } from '@/lib/view-mode'

// Server gate for the obra feed. Anonymous renders never call this: the
// public home does not. A signed-in person with no obra is refused here too.
export async function viewerCanSeeObraFeed(): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const user = await getCurrentUser()
  if (!user) return false
  const admin = isAdminEmail(user.email)
  const adminView = await isAdminView(user)
  if (admin && !adminView) return true
  if (admin && adminView) return false
  const { count } = await (await createClient())
    .from('artworks')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .is('archived_at', null)
  return canSeeObraFeed({ signedIn: true, participating: (count ?? 0) > 0, admin, adminView })
}
