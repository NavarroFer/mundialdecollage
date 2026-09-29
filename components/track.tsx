'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { track } from '@/lib/track'
import type { FunnelEvent } from '@/lib/funnel'

// For server components that need to report a circuit step (lib/funnel.ts):
// <TrackView> when something is shown, <TrackedLink> when it's clicked.
export function TrackView({ event }: { event: FunnelEvent }) {
  useEffect(() => track(event), [event])
  return null
}

// Records an impression only once the marker actually enters the viewport.
// This keeps below-the-fold CTAs from looking "seen" just because the page
// rendered them on the server.
export function TrackVisible({ event }: { event: FunnelEvent }) {
  const markerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      track(event)
      observer.disconnect()
    })
    observer.observe(marker)
    return () => observer.disconnect()
  }, [event])

  return <span ref={markerRef} aria-hidden="true" className="sr-only" />
}

export function TrackedLink({ event, ...props }: React.ComponentProps<typeof Link> & { event: FunnelEvent }) {
  return <Link {...props} onClick={(e) => { track(event); props.onClick?.(e) }} />
}

// Same as TrackedLink, for plain anchors (downloads, mailto) that aren't routes.
export function TrackedAnchor({ event, ...props }: React.ComponentProps<'a'> & { event: FunnelEvent }) {
  return <a {...props} onClick={(e) => { track(event); props.onClick?.(e) }} />
}
