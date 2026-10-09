'use client'

import { useRef } from 'react'
import { AnimatedNumber } from '@/components/animated-number'
import { useLiveHomeStats } from '@/components/use-live-home-stats'

// The edition banner's «recibimos N obras»: starts from the page's total and
// follows new submissions while it's on screen (components/use-live-home-stats.ts).
export function LiveReceivedCount({ initial }: { initial: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const live = useLiveHomeStats(ref)
  return (
    <span ref={ref}>
      <AnimatedNumber value={live?.received ?? initial} />
    </span>
  )
}
