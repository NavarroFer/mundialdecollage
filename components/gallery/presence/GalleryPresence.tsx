'use client'

import { useEffect, useRef } from 'react'
import { RealtimeClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { Artwork } from '@/data/artworks'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useInteractionStore } from '../interaction/store'
import { summarizePresence } from './protocol'
import { usePresenceStore } from './store'

// Every open /galeria-3d tab listens on one public Realtime channel, but only
// tabs that have entered the exhibition and are in the foreground announce
// themselves. Presence lives in Supabase's memory — no table, and the payload
// is just which obra is open, so nothing about a visitor is sent or stored.
const TOPIC = 'galeria-3d'

type Connection = { channel: RealtimeChannel | null; key: string; joined: boolean; inside: boolean }

function announce({ channel, joined, inside }: Connection) {
  if (!channel || !joined) return
  if (inside && document.visibilityState === 'visible') void channel.track({ viewing: useInteractionStore.getState().openId })
  else void channel.untrack()
}

export function GalleryPresence({ inside, artworks }: { inside: boolean; artworks: Artwork[] }) {
  const connection = useRef<Connection>({ channel: null, key: '', joined: false, inside: false })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const { setSummary } = usePresenceStore.getState()
    const artworkIds = new Set(artworks.map((artwork) => artwork.id))
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const url = new URL('realtime/v1', process.env.NEXT_PUBLIC_SUPABASE_URL)
    url.protocol = url.protocol.replace('http', 'ws')
    // Its own socket instead of the shared browser client: that client hands
    // back the same still-closing channel for a repeated topic, which breaks
    // the unmount/remount React does in development.
    const client = new RealtimeClient(url.href, { params: { apikey: anonKey }, accessToken: async () => anonKey })
    const current = connection.current
    current.key = crypto.randomUUID()
    const channel = client.channel(TOPIC, { config: { presence: { key: current.key } } })
    current.channel = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        if (current.channel === channel) setSummary(summarizePresence(channel.presenceState(), current.key, artworkIds))
      })
      .subscribe((status) => {
        // A channel from a previous mount can still report CLOSED late.
        if (current.channel !== channel) return
        current.joined = status === 'SUBSCRIBED'
        // Realtime rejoins on its own after a dropped connection and reports
        // SUBSCRIBED again, which re-announces this tab.
        if (current.joined) announce(current)
        else setSummary(null)
      })

    const onVisibilityChange = () => announce(current)
    document.addEventListener('visibilitychange', onVisibilityChange)
    const stopWatchingModal = useInteractionStore.subscribe((state, previous) => {
      if (state.openId !== previous.openId) announce(current)
    })
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopWatchingModal()
      current.channel = null
      current.joined = false
      setSummary(null)
      void channel.unsubscribe().finally(() => client.disconnect())
    }
  }, [artworks])

  useEffect(() => {
    connection.current.inside = inside
    announce(connection.current)
  }, [inside])

  return null
}
