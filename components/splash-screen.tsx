'use client'

import Image from 'next/image'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BrandPapers, measurePapers } from '@/components/brand-papers'
import { PaperShards, type PaperShardsHandle } from '@/components/paper-shards'
import { useI18n } from '@/lib/i18n/client'
import { markSplashSeen, splashSeen } from '@/lib/splash'

// Torn scraps stream in around the logo and, without stopping, gather into
// the three big papers, which ease out of the frame as they form; the logo
// dissolves into the page as they go.
const GATHER_MS = 500
// From the moment the papers are whole: they're still on their way out, so
// the cover waits a little before going too.
const COVER_AFTER_FORMED_MS = 250
// In case the scraps never gather (no canvas): the page doesn't stay covered.
const LATEST_MS = 4000
const EXIT_MS = 350
// The page's count-ups (lib/splash.ts) start this long before the cover is
// fully gone, so they're already moving as the page comes into view.
const HEAD_START_MS = 500

// Only read on render: the flag is written as the cover unmounts, so no
// re-render while it plays sees it change.
const noopSubscribe = () => () => {}

export function SplashScreen() {
  // Render the cover in the server HTML. Waiting for an effect here exposes
  // the home page for a frame before hydration finishes.
  const [mounted, setMounted] = useState(true)
  const [visible, setVisible] = useState(true)
  // Hydration takes the server's answer (cover on) and then drops it for a
  // returning visitor, whose copy the <head> script (lib/splash.ts) already hid.
  const seen = useSyncExternalStore(noopSubscribe, splashSeen, () => false)
  const covering = mounted && !seen
  const dismissedRef = useRef(false)
  const coverRef = useRef<HTMLDivElement>(null)
  const scrapsRef = useRef<PaperShardsHandle>(null)
  const papersRef = useRef<HTMLDivElement>(null)
  const { m } = useI18n()

  // Set on the DOM node directly: once `visible` flips, AnimatePresence keeps
  // rendering the exiting cover with its last props, so state wouldn't reach it.
  const markLeaving = useCallback(() => {
    coverRef.current?.setAttribute('data-leaving', '')
  }, [])

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    scrapsRef.current?.leave()
    markLeaving()
    setVisible(false)
  }, [markLeaving])

  useEffect(() => {
    if (!visible || seen) return

    let cancelled = false
    const timers: number[] = []
    const later = (callback: () => void, ms: number) => {
      timers.push(window.setTimeout(callback, ms))
    }
    later(() => {
      const gathering = scrapsRef.current?.gather(measurePapers(papersRef.current))
      void gathering?.formed.then(() => {
        if (cancelled) return
        later(markLeaving, Math.max(0, COVER_AFTER_FORMED_MS + EXIT_MS - HEAD_START_MS))
        later(dismiss, COVER_AFTER_FORMED_MS)
      })
    }, GATHER_MS)
    later(dismiss, LATEST_MS)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dismiss, markLeaving, visible, seen])

  // Keep the covered page out of the keyboard and accessibility flow until
  // Framer Motion has finished the exit animation.
  useEffect(() => {
    const content = document.getElementById('site-content')
    content?.toggleAttribute('inert', covering)
    return () => content?.removeAttribute('inert')
  }, [covering])

  if (!covering) return null

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence
        onExitComplete={() => {
          markSplashSeen()
          setMounted(false)
        }}
      >
        {visible && (
          <motion.div
          key="brand-splash"
          ref={coverRef}
          data-splash
          className="fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-paper"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: EXIT_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
        >
          <BrandPapers ref={papersRef} />
          <PaperShards ref={scrapsRef} speed={1.6} className="absolute inset-0" />

          {/* The first visit's largest image, so fetched ahead of the rest —
              but lazy rather than preloaded: for a returning visitor the
              cover is display:none from the <head> script, and a lazy image
              that never lays out is never downloaded. */}
          <Image
            src="/logo.png"
            alt="Mundial de Collage"
            fetchPriority="high"
            sizes="(min-width: 1067px) 896px, 84vw"
            width={1415}
            height={370}
            className="relative z-10 h-auto w-[84vw] max-w-4xl drop-shadow-[6px_8px_0_rgba(27,17,12,0.16)]"
          />

          <div className="grain-overlay pointer-events-none absolute inset-0" />
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-5 bottom-6 z-20 min-h-11 px-2 text-sm font-semibold text-ink/70 underline underline-offset-4 hover:text-ink sm:right-8"
          >
            {m.splash.skip}
          </button>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}
