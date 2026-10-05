import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notificationRepository } from './repository'

// Once per request: the header renders the bell in both its desktop and its
// phone layout. A failure only hides the badge, never the page.
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  try {
    return await notificationRepository(await createClient()).countUnread()
  } catch (error) {
    console.error('notifications: unread count failed', error)
    return 0
  }
})
