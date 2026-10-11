'use client'

import { useEffect, useRef } from 'react'
import type { Artwork } from '@/data/artworks'
import { attentionCandidate, createAttentionAccumulator, type AttentionBatch } from '@/lib/gallery-attention'
import { useInteractionStore } from '../interaction/store'
import { attentionTarget } from './target'

export function AttentionRecorder({ artworks, walking, enabled, userId }: { userId: string; artworks: Artwork[]; walking: boolean; enabled: boolean }) {
  const latest = useRef({ walking, enabled })
  useEffect(() => { latest.current = { walking, enabled } }, [walking, enabled])
  useEffect(() => {
    const ids = new Set(artworks.map((artwork) => artwork.id))
    const accumulator = createAttentionAccumulator()
    const sessionId = crypto.randomUUID()
    let lastInput = performance.now()
    let lastSent = ''
    let sending = false
    let stopped = false
    const activity = () => { lastInput = performance.now() }
    const reset = () => accumulator.sample(null, performance.now())
    function sample() {
      const now = performance.now()
      const target = attentionCandidate({ ...latest.current, now, lastInput,
        visible: document.visibilityState === 'visible', focused: document.hasFocus(),
        openId: useInteractionStore.getState().openId, ray: attentionTarget,
      })
      accumulator.sample(target && ids.has(target.slug) ? target : null, now)
    }
    function flush(beacon = false) {
      const rows = accumulator.snapshot()
      if (!rows.length || stopped) return
      const body = JSON.stringify({ sessionId, accountId: userId, rows } satisfies AttentionBatch)
      if (body === lastSent) return
      if (beacon && navigator.sendBeacon?.('/api/gallery/attention', new Blob([body], { type: 'application/json' }))) return
      if (sending) return
      sending = true
      void fetch('/api/gallery/attention', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
        .then((response) => {
          if (response.ok) lastSent = body
          // An expired session must never be reassigned to a new account.
          if (response.status === 401 || response.status === 403) stopped = true
        }).catch(() => {}).finally(() => { sending = false })
    }
    const hidden = () => { if (document.visibilityState === 'hidden') { reset(); flush(true) } else activity() }
    const leave = () => { reset(); flush(true) }
    const blur = () => { reset(); flush(true) }
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchmove', 'scroll'] as const
    events.forEach((name) => document.addEventListener(name, activity, { capture: true, passive: true }))
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', leave)
    window.addEventListener('blur', blur)
    window.addEventListener('focus', activity)
    const sampleTimer = setInterval(sample, 250)
    const sendTimer = setInterval(() => flush(), 30_000)
    return () => {
      clearInterval(sampleTimer); clearInterval(sendTimer)
      events.forEach((name) => document.removeEventListener(name, activity, true))
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('blur', blur)
      window.removeEventListener('focus', activity)
      // SPA links do not emit pagehide. The server checks accountId against
      // the verified session, so logout/account changes cannot reassign this batch.
      reset(); flush(true)
    }
  }, [artworks, userId])
  return null
}
