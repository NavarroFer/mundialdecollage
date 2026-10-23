'use client'

import { useEffect, useRef } from 'react'
import { RealtimeClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { Artwork } from '@/data/artworks'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useInteractionStore } from '../interaction/store'
import { usePlayerTrackerStore } from '../minimap/store'
import { useGalleryPreferences } from '../preferences/store'
import {
  MAX_LIVE_VISITORS, parsePose, poseMessage, shouldSendPose, summarizePresence, type SentPose,
} from './protocol'
import { peerPoses, prunePeerPoses, recordPeerPose, usePresenceStore } from './store'

// Every open /galeria-3d tab listens on one public Realtime channel, but only
// tabs that have entered the exhibition and are in the foreground announce
// themselves. Presence lives in Supabase's memory — no table, and the payload
// is just which obra is open, so nothing about a visitor is sent or stored.
// Avatar positions ride the same channel as broadcasts: delivered live,
// never kept. A crouch or a jump rides on them too, under the same throttle.
// Local dev shares the production Supabase project; a separate topic keeps
// `next dev` sessions out of the real gallery's count and avatars.
const TOPIC = process.env.NODE_ENV === 'production' ? 'galeria-3d' : 'galeria-3d-dev'
// A background tab still receives every broadcast — and each delivery counts
// against the Realtime message quota — so one left hidden this long lets go
// of its connection, and reconnects when it's shown again.
const HIDDEN_DISCONNECT_MS = 60_000
// Kill switch for the quota: NEXT_PUBLIC_GALLERY_LIVE=off (and a redeploy)
// turns off the count and avatars; the gallery itself still works.
const LIVE_ENABLED = process.env.NEXT_PUBLIC_GALLERY_LIVE !== 'off'
// Catches the spot where someone stopped between two throttled sends.
const POSE_CHECK_MS = 500

type Connection = {
  channel: RealtimeChannel | null
  key: string
  joined: boolean
  inside: boolean
  lastPose: SentPose | null
  seq: number
}

function isPresent({ channel, joined, inside }: Connection) {
  return Boolean(channel && joined && inside && document.visibilityState === 'visible')
}

function announce(connection: Connection) {
  if (!connection.channel || !connection.joined) return
  if (isPresent(connection)) {
    void connection.channel.track({ viewing: useInteractionStore.getState().openId })
    // Whoever sees us (re)appear needs our position right away.
    connection.lastPose = null
    sendPose(connection)
  } else {
    void connection.channel.untrack()
  }
}

function sendPose(connection: Connection) {
  if (!connection.channel || !isPresent(connection)) return
  if ((usePresenceStore.getState().count ?? 0) > MAX_LIVE_VISITORS) return
  const { x, z, heading, crouching, jumps } = usePlayerTrackerStore.getState()
  const next = { x, z, h: heading, crouching, jumps, t: Date.now() }
  if (!shouldSendPose(connection.lastPose, next)) return
  connection.lastPose = next
  const avatar = useGalleryPreferences.getState().avatar ?? undefined
  const payload = poseMessage({ key: connection.key, seq: connection.seq++, x, z, h: heading, avatar, crouching, jumps })
  void connection.channel.send({ type: 'broadcast', event: 'pose', payload })
}

// Opens this tab's socket and joins the channel; returns what closes them.
function openChannel(current: Connection, artworkIds: ReadonlySet<string>): () => void {
  const { setSummary } = usePresenceStore.getState()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const url = new URL('realtime/v1', process.env.NEXT_PUBLIC_SUPABASE_URL)
  url.protocol = url.protocol.replace('http', 'ws')
  // Its own socket instead of the shared browser client: that client hands
  // back the same still-closing channel for a repeated topic, which breaks
  // the unmount/remount React does in development.
  const client = new RealtimeClient(url.href, { params: { apikey: anonKey }, accessToken: async () => anonKey })
  current.key = crypto.randomUUID()
  current.seq = 0
  const channel = client.channel(TOPIC, { config: { presence: { key: current.key } } })
  current.channel = channel

  channel
    .on('presence', { event: 'sync' }, () => {
      if (current.channel !== channel) return
      const summary = summarizePresence(channel.presenceState(), current.key, artworkIds)
      setSummary(summary)
      prunePeerPoses(new Set(summary.peers), Date.now())
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      if (current.channel !== channel || key === current.key) return
      // A newcomer only hears positions sent after they arrived.
      current.lastPose = null
      sendPose(current)
    })
    .on('broadcast', { event: 'pose' }, ({ payload }) => {
      const pose = parsePose(payload)
      if (pose && pose.key !== current.key && current.channel === channel) recordPeerPose(pose, Date.now())
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

  return () => {
    peerPoses.clear()
    current.channel = null
    current.joined = false
    current.lastPose = null
    setSummary(null)
    void channel.unsubscribe().finally(() => client.disconnect())
  }
}

export function GalleryPresence({ inside, artworks }: { inside: boolean; artworks: Artwork[] }) {
  const connection = useRef<Connection>({ channel: null, key: '', joined: false, inside: false, lastPose: null, seq: 0 })

  useEffect(() => {
    if (!isSupabaseConfigured || !LIVE_ENABLED) return
    const current = connection.current
    const artworkIds = new Set(artworks.map((artwork) => artwork.id))
    let disconnect: (() => void) | null = null
    const connect = () => {
      disconnect ??= openChannel(current, artworkIds)
    }

    let hiddenTimer: number | undefined
    const onVisibilityChange = () => {
      window.clearTimeout(hiddenTimer)
      if (document.visibilityState === 'visible') {
        // Joining announces this tab; an already-open channel just re-tracks.
        connect()
        announce(current)
      } else {
        announce(current)
        hiddenTimer = window.setTimeout(() => {
          disconnect?.()
          disconnect = null
        }, HIDDEN_DISCONNECT_MS)
      }
    }

    // A tab opened in the background waits until it's first shown.
    if (document.visibilityState === 'visible') connect()
    document.addEventListener('visibilitychange', onVisibilityChange)
    const stopWatchingModal = useInteractionStore.subscribe((state, previous) => {
      if (state.openId !== previous.openId) announce(current)
    })
    const stopWatchingPose = usePlayerTrackerStore.subscribe(() => sendPose(current))
    const poseCheck = setInterval(() => sendPose(current), POSE_CHECK_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearTimeout(hiddenTimer)
      stopWatchingModal()
      stopWatchingPose()
      clearInterval(poseCheck)
      disconnect?.()
    }
  }, [artworks])

  useEffect(() => {
    connection.current.inside = inside
    announce(connection.current)
  }, [inside])

  return null
}
