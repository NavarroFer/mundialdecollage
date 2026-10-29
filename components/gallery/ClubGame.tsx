'use client'

import { useEffect, useState, type ComponentProps } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { Game } from './Game'

/**
 * A member's Club gallery. The page is the same for everyone and is served
 * from the CDN, so it cannot know who is looking; the browser can. Once it
 * finds a session the room records that account's attention (the member's
 * stats) and, when it is the member's own, shows them live as the host,
 * without the page ever reading cookies.
 */
export function ClubGame({ ownerKey, ...props }: Omit<ComponentProps<typeof Game>, 'userId' | 'clubOwner'> & { ownerKey?: string }) {
  const [session, setSession] = useState<{ userId: string | null; hash: string | null }>({ userId: null, hash: null })
  // The page carries only a hash of its member's id (lib/club-galleries.ts):
  // the same hash of this session's id says whether they are the host.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const { data } = createClient().auth.onAuthStateChange((_event, current) => {
      const userId = current?.user.id ?? null
      if (!userId) { setSession({ userId: null, hash: null }); return }
      void crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId.toLowerCase())).then((digest) => {
        setSession({ userId, hash: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') })
      })
    })
    return () => data.subscription.unsubscribe()
  }, [])
  const isOwner = Boolean(ownerKey && session.hash === ownerKey)
  return <Game {...props} userId={session.userId} clubOwner={isOwner} />
}
