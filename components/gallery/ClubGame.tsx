'use client'

import { useEffect, useState, type ComponentProps } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { Game } from './Game'

/**
 * A member's Club gallery. The page is the same for everyone and is served
 * from the CDN, so it cannot know who is looking; the browser can. Once it
 * finds a session the room records that account's attention (the member's
 * stats), without the page ever reading cookies.
 */
export function ClubGame(props: Omit<ComponentProps<typeof Game>, 'userId'>) {
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const { data } = createClient().auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [])
  return <Game {...props} userId={userId} />
}
