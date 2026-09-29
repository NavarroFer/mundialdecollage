'use client'

import Image from 'next/image'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/client'

// The papers clear the frame first, then the logo dissolves into the page.
const INTRO_MS = 1250

export function SplashScreen() {
  // Render the cover in the server HTML. Waiting for an effect here exposes
  // the home page for a frame before hydration finishes.
  const [mounted, setMounted] = useState(true)
  const [visible, setVisible] = useState(true)
  const dismissedRef = useRef(false)
  const { m } = useI18n()

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    setVisible(false)
  }, [])

  useEffect(() => {
    if (!visible) return

    const timer = window.setTimeout(dismiss, INTRO_MS)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dismiss, visible])

  // Keep the covered page out of the keyboard and accessibility flow until
  // Framer Motion has finished the exit animation.
  useEffect(() => {
    const content = document.getElementById('site-content')
    content?.toggleAttribute('inert', mounted)
    return () => content?.removeAttribute('inert')
  }, [mounted])

  if (!mounted) return null

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence onExitComplete={() => setMounted(false)}>
        {visible && (
          <motion.div
          key="brand-splash"
          className="fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-paper"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
            className="absolute -top-[18vh] -left-[18vw] h-[66vh] w-[58vw] bg-collage-blue sm:-left-[8vw] sm:w-[42vw]"
            style={{
              clipPath:
                'polygon(3% 6%, 94% 0, 100% 22%, 93% 52%, 100% 91%, 68% 100%, 38% 92%, 0 100%)',
            }}
            initial={{ x: 0, rotate: -5 }}
            animate={{ x: '-115%', y: '-18%', rotate: -13 }}
            transition={{ duration: 0.62, delay: 0.35, ease: [0.7, 0, 0.84, 0] }}
          />

          <motion.div
            className="absolute -right-[17vw] -bottom-[20vh] h-[67vh] w-[58vw] bg-collage-red sm:-right-[8vw] sm:w-[42vw]"
            style={{
              clipPath:
                'polygon(10% 4%, 62% 0, 96% 15%, 90% 44%, 100% 72%, 80% 100%, 38% 94%, 0 100%, 6% 55%, 0 24%)',
            }}
            initial={{ x: 0, rotate: 5 }}
            animate={{ x: '115%', y: '18%', rotate: 13 }}
            transition={{ duration: 0.62, delay: 0.38, ease: [0.7, 0, 0.84, 0] }}
          />

          <motion.div
            className="torn-strip absolute inset-x-[-8%] top-[52%] h-14 -rotate-3 bg-collage-yellow sm:h-20"
            initial={{ x: 0, opacity: 1 }}
            animate={{ x: '115%', opacity: 0 }}
            transition={{ duration: 0.56, delay: 0.43, ease: [0.7, 0, 0.84, 0] }}
          />

          <Image
            src="/logo.png"
            alt="Mundial de Collage"
            priority
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
