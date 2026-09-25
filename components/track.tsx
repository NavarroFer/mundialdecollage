'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { track } from '@/lib/track'
import type { FunnelEvent } from '@/lib/funnel'

// For server components that need to report a circuit step (lib/funnel.ts):
// <TrackView> when something is shown, <TrackedLink> when it's clicked.
export function TrackView({ event }: { event: FunnelEvent }) {
  useEffect(() => track(event), [event])
  return null
}

export function TrackedLink({ event, ...props }: React.ComponentProps<typeof Link> & { event: FunnelEvent }) {
  return <Link {...props} onClick={(e) => { track(event); props.onClick?.(e) }} />
}
