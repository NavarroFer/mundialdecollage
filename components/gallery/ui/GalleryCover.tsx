'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BrandPapers, measurePapers } from '@/components/brand-papers'
import { PaperShards, type PaperShardsHandle } from '@/components/paper-shards'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

// Back to the walk from the menu: the scraps blow away as the paper fades.
const LEAVE_MS = 500
// In case the scraps never gather (no canvas): the walk isn't kept covered.
const LATEST_MS = 4000

/** Keeps the cover on screen for its way out, until it says it's done. */
export function useCover(wanted: boolean) {
  const [lingering, setLingering] = useState(false)
  const [wasWanted, setWasWanted] = useState(wanted)
  if (wasWanted !== wanted) {
    setWasWanted(wanted)
    setLingering(!wanted)
  }
  const exited = useCallback(() => setLingering(false), [])
  return { mounted: wanted || lingering, leaving: lingering, exited }
}

type GalleryCoverProps = {
  /** The scene is loading after ENTRAR: the home's splash, logo and all. */
  loading: boolean
  /** A walk under it, paused: it shows through the paper. */
  translucent: boolean
  leaving: boolean
  /** Fades in when the menu comes back; the first one is there from the start. */
  fadeIn: boolean
  onExited: () => void
}

/**
 * The home's splash (components/splash-screen.tsx) behind the gallery's menu
 * and over the scene while it loads: the paper, the brand's torn scraps
 * streaming past and, while loading, the logo. Once the scene is ready the
 * scraps gather into the big papers, which clear the frame like a curtain
 * as the paper behind them opens onto the walk.
 */
export function GalleryCover({ loading, translucent, leaving, fadeIn, onExited }: GalleryCoverProps) {
  const { m } = useI18n()
  const scraps = useRef<PaperShardsHandle>(null)
  const papersRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // On its way out it keeps the look it had: the logo stays as the walk
  // shows through, instead of vanishing the moment the scene is ready.
  const [look, setLook] = useState({ loading, translucent })
  if (!leaving && (look.loading !== loading || look.translucent !== translucent)) setLook({ loading, translucent })
  // Scraps that already left can't come back: wanted again mid-exit, the
  // cover starts over with a fresh stream.
  const [round, setRound] = useState(0)
  const [wasLeaving, setWasLeaving] = useState(leaving)
  if (wasLeaving !== leaving) {
    setWasLeaving(leaving)
    if (!leaving) {
      setRound(round + 1)
      setOpen(false)
    }
  }

  useEffect(() => {
    if (!leaving) return
    let cancelled = false
    const timers: number[] = []
    const later = (callback: () => void, ms: number) => {
      timers.push(window.setTimeout(callback, ms))
    }
    const gathering = look.loading ? scraps.current?.gather(measurePapers(papersRef.current)) : undefined
    if (gathering) {
      void gathering.formed.then(() => {
        if (!cancelled) setOpen(true)
      })
      void gathering.gone.then(() => {
        if (!cancelled) onExited()
      })
    } else {
      scraps.current?.leave()
      later(onExited, LEAVE_MS)
    }
    later(onExited, LATEST_MS)
    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [leaving, look.loading, onExited])

  const fade = 'transition-opacity duration-300'
  return (
    <div
      aria-hidden={!look.loading}
      className={cn(
        'pointer-events-none absolute inset-0 z-30 grid place-items-center overflow-hidden transition-opacity duration-[450ms] ease-out',
        fadeIn && 'animate-in fade-in',
        leaving && !look.loading && 'opacity-0',
      )}
    >
      <div className={cn('absolute inset-0', fade, look.translucent ? 'bg-paper/85 backdrop-blur-sm' : 'bg-paper', open && 'opacity-0')} />
      <BrandPapers ref={papersRef} />
      <PaperShards key={round} ref={scraps} className="absolute inset-0" />
      {look.loading && (
        <div role="status" className={cn('relative flex flex-col items-center gap-8 px-5', fade, open && 'opacity-0')}>
          {/* The same image and sizes as the home's splash, so it's usually cached already. */}
          <Image
            src="/logo.png"
            alt="Mundial de Collage"
            sizes="(min-width: 1067px) 896px, 84vw"
            width={1415}
            height={370}
            className="h-auto w-[84vw] max-w-4xl drop-shadow-[6px_8px_0_rgba(27,17,12,0.16)]"
          />
          <p className="torn-strip -rotate-2 bg-collage-blue px-5 py-2 text-xs font-bold tracking-[0.2em] text-primary-foreground uppercase sm:text-sm">
            {m.gallery.loading}
          </p>
        </div>
      )}
      <div className={cn('grain-overlay absolute inset-0', fade, open && 'opacity-0')} />
    </div>
  )
}
