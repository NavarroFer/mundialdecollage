'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

// How hard a burst of scroll velocity nudges the tilt, in degrees per px/frame.
const TILT_FACTOR = 0.6
const MAX_TILT = 6
// Parallax: the image drifts up slightly as the page scrolls past it.
const PARALLAX_FACTOR = 0.08
const MAX_PARALLAX = 28
// How long the page has to sit still before the idle float kicks in.
const IDLE_DELAY = 3000
// Per-frame ease toward the current target (spring-ish settle, not linear).
const SETTLE = 0.14
const EPSILON = 0.01

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

export function HeroHeaderMedia() {
  const scrollLayerRef = useRef<HTMLDivElement | null>(null)
  const floatLayerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let lastY = window.scrollY
    let tilt = 0
    let targetTilt = 0
    let parallax = 0
    let rafId: number | null = null
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const applyTransform = () => {
      scrollLayerRef.current?.style.setProperty(
        'transform',
        `translateY(${parallax.toFixed(2)}px) rotate(${tilt.toFixed(3)}deg)`,
      )
    }

    const tick = () => {
      tilt += (targetTilt - tilt) * SETTLE
      targetTilt *= 0.9
      applyTransform()

      if (Math.abs(tilt) > EPSILON || Math.abs(targetTilt) > EPSILON) {
        rafId = requestAnimationFrame(tick)
      } else {
        tilt = 0
        applyTransform()
        rafId = null
      }
    }

    const ensureLoop = () => {
      if (rafId === null) rafId = requestAnimationFrame(tick)
    }

    const armIdleFloat = () => {
      floatLayerRef.current?.classList.remove('animate-float-hero')
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        floatLayerRef.current?.classList.add('animate-float-hero')
      }, IDLE_DELAY)
    }

    const onScroll = () => {
      const y = window.scrollY
      const velocity = y - lastY
      lastY = y

      targetTilt = clamp(targetTilt + velocity * TILT_FACTOR, -MAX_TILT, MAX_TILT)
      parallax = clamp(-y * PARALLAX_FACTOR, -MAX_PARALLAX, MAX_PARALLAX)
      ensureLoop()
      armIdleFloat()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    armIdleFloat()

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (idleTimer) clearTimeout(idleTimer)
    }
  }, [])

  return (
    <div ref={scrollLayerRef} className="will-change-transform">
      <div ref={floatLayerRef} className="relative">
        <Image
          src="/header.png"
          alt="Mundial de Collage"
          width={1000}
          height={1000}
          priority
          sizes="(max-width: 672px) 100vw, 672px"
          className="mix-blend-multiply h-auto w-full"
        />
        <div className="grain-overlay pointer-events-none absolute inset-0" />
      </div>
    </div>
  )
}
