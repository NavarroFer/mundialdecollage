'use client'

import { useEffect, useRef } from 'react'
import { RealtimeClient, type RealtimeChannel } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { usePresenceStore } from './store'

// Every open /galeria-3d tab listens on one public Realtime channel, but only
// tabs that have entered the exhibition and are in the foreground announce
// themselves. Presence lives in Supabase's memory — no table, and the payload
// is empty, so nothing about a visitor is sent or stored.
const TOPIC = 'galeria-3d'

type Connection = { channel: RealtimeChannel | null; joined: boolean; inside: boolean }

function announce({ channel, joined, inside }: Connection) {
  if (!channel || !joined) return
  if (inside && document.visibilityState === 'visible') void channel.track({})
  else void channel.untrack()
}

export function GalleryPresence({ inside }: { inside: boolean }) {
  const connection = useRef<Connection>({ channel: null, joined: false, inside: false })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const { setCount } = usePresenceStore.getState()
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const url = new URL('realtime/v1', process.env.NEXT_PUBLIC_SUPABASE_URL)
    url.protocol = url.protocol.replace('http', 'ws')
    // Its own socket instead of the shared browser client: that client hands
    // back the same still-closing channel for a repeated topic, which breaks
    // the unmount/remount React does in development.
    const client = new RealtimeClient(url.href, { params: { apikey: anonKey }, accessToken: async () => anonKey })
    const channel = client.channel(TOPIC, { config: { presence: { key: crypto.randomUUID() } } })
    const current = connection.current
    current.channel = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        if (current.channel === channel) setCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe((status) => {
        // A channel from a previous mount can still report CLOSED late.
        if (current.channel !== channel) return
        current.joined = status === 'SUBSCRIBED'
        // Realtime rejoins on its own after a dropped connection and reports
        // SUBSCRIBED again, which re-announces this tab.
        if (current.joined) announce(current)
        else setCount(null)
      })

    const onVisibilityChange = () => announce(current)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      current.channel = null
      current.joined = false
      setCount(null)
      void channel.unsubscribe().finally(() => client.disconnect())
    }
  }, [])

  useEffect(() => {
    connection.current.inside = inside
    announce(connection.current)
  }, [inside])

  return null
}
