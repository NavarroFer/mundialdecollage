'use client'

import { useEffect, useRef } from 'react'

// How long the page has to sit still before the idle float kicks in.
const IDLE_DELAY = 3000

export function HeroHeaderMedia() {
  const floatLayerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const timer = setTimeout(() => {
      floatLayerRef.current?.classList.add('animate-float-hero')
    }, IDLE_DELAY)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div ref={floatLayerRef} className="relative">
      <video
        src="/header.mp4"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        className="mix-blend-multiply h-auto w-full"
      />
      <div className="grain-overlay pointer-events-none absolute inset-0" />
    </div>
  )
}
