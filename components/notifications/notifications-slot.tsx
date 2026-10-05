import { ADMIN_EMAILS } from '@/lib/admin'
import { getUnreadNotificationCount } from '@/lib/notifications/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getCurrentUser } from '@/lib/supabase/server'
import { NotificationBell } from './notification-bell'

/** The bell for whoever is signed in; nothing for visitors without a session. */
export async function NotificationsSlot({ className }: { className?: string }) {
  if (!isSupabaseConfigured) return null
  const user = await getCurrentUser()
  if (!user) return null

  const unread = await getUnreadNotificationCount()
  return <NotificationBell initialUnread={unread} isAdmin={ADMIN_EMAILS.includes(user.email ?? '')} className={className} />
}
