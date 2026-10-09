'use client'

import { useEffect, useSyncExternalStore, type RefObject } from 'react'
import { RealtimeClient, type RealtimeChannel } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import {
  HOME_STATS_EVENT, HOME_STATS_TOPIC, createConnectionKeeper, parseHomeStats, type HomeStats,
} from '@/lib/home-stats'

// Kill switch for the Supabase quota: NEXT_PUBLIC_HOME_LIVE=off (and a
// redeploy) leaves the counters at what the page was built with.
const LIVE_ENABLED = process.env.NEXT_PUBLIC_HOME_LIVE !== 'off'
const IDLE_DISCONNECT_MS = 30_000

// Shared by every counter on the page (lib/home-stats.ts): the latest totals
// received, and the one connection that receives them.
let latest: HomeStats | null = null
const listeners = new Set<() => void>()
let mounted = 0
let activeChannel: RealtimeChannel | null = null
// A tab that had already joined missed whatever changed while it was away.
let joinedBefore = false
// Realtime refused the topic (its policy missing, say): retrying every few
// seconds would only load it for nothing, so this page view stops trying.
let refused = false

function publish(stats: HomeStats) {
  latest = stats
  for (const listener of listeners) listener()
}

// One small read straight from Supabase, only after a reconnect: a fresh
// page already has the current totals.
async function catchUp() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  try {
    const response = await fetch(new URL('rest/v1/rpc/home_stats', process.env.NEXT_PUBLIC_SUPABASE_URL), {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const stats = response.ok ? parseHomeStats(await response.json()) : null
    if (stats && mounted > 0) publish(stats)
  } catch {
    // The counters keep what they show until the next change arrives.
  }
}

function openChannel(): () => void {
  if (refused) return () => {}
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const url = new URL('realtime/v1', process.env.NEXT_PUBLIC_SUPABASE_URL)
  url.protocol = url.protocol.replace('http', 'ws')
  // Its own socket, like the gallery's (components/gallery/presence/GalleryPresence.tsx).
  const client = new RealtimeClient(url.href, { params: { apikey: anonKey }, accessToken: async () => anonKey })
  // Private: only the database may send on it (the migration's policy).
  const channel = client.channel(HOME_STATS_TOPIC, { config: { private: true } })
  activeChannel = channel
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    if (activeChannel === channel) activeChannel = null
    void channel.unsubscribe().finally(() => client.disconnect())
  }
  channel
    .on('broadcast', { event: HOME_STATS_EVENT }, ({ payload }) => {
      const stats = parseHomeStats(payload)
      if (stats && activeChannel === channel) publish(stats)
    })
    .subscribe((status, error) => {
      if (activeChannel !== channel) return
      if (status === 'CHANNEL_ERROR' && /unauthorized/i.test(error?.message ?? '')) {
        refused = true
        close()
        return
      }
      // Realtime also rejoins on its own after a dropped connection.
      if (status !== 'SUBSCRIBED') return
      if (joinedBefore) void catchUp()
      joinedBefore = true
    })
  return close
}

const connection = createConnectionKeeper(openChannel, IDLE_DISCONNECT_MS)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The latest totals the database sent, or null until a change arrives (show
 * the page's own until then). Listens only while `ref`'s element is on screen
 * in a visible tab.
 */
export function useLiveHomeStats(ref: RefObject<Element | null>): HomeStats | null {
  const stats = useSyncExternalStore(subscribe, () => latest, () => null)

  useEffect(() => {
    mounted++
    const element = ref.current
    const live = isSupabaseConfigured && LIVE_ENABLED && element
    let onScreen = false
    let watching = false
    const update = () => {
      const shouldWatch = onScreen && document.visibilityState === 'visible'
      if (shouldWatch === watching) return
      watching = shouldWatch
      if (shouldWatch) connection.watch()
      else connection.unwatch()
    }
    const observer = live
      ? new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting
        update()
      })
      : null
    if (observer && element) observer.observe(element)
    if (live) document.addEventListener('visibilitychange', update)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', update)
      if (watching) connection.unwatch()
      // Leaving the home: totals from this visit could be older than the ones
      // the next visit's page brings.
      if (--mounted === 0) latest = null
    }
  }, [ref])

  return stats
}
