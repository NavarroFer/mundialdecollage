'use client'

import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/client'

// A fresh tab gets the intro; reloads and back-navigation in the same session
// go straight to the page.
const SESSION_KEY = 'mdc-splash-seen'

// 1.25s on screen + the 0.35s exit below = a 1.6s brand intro.
const INTRO_MS = 1250

const logoPart = {
  hidden: { opacity: 0, y: 18, scale: 0.88, rotate: -3 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotate: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
  },
}

export function SplashScreen() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const dismissedRef = useRef(false)
  const { m } = useI18n()

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
    } catch {
      // Storage can fail in private browsing. The intro should still work.
    }

    const frame = window.requestAnimationFrame(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // Same private-browsing fallback as the read above.
      }
      setMounted(true)
      setVisible(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

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
    <AnimatePresence onExitComplete={() => setMounted(false)}>
      {visible && (
        <motion.div
          key="brand-splash"
          className="fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-paper"
          initial={{ opacity: 0 }}
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
            initial={{ x: '-105%', rotate: -12 }}
            animate={{ x: 0, rotate: -5 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />

          <motion.div
            className="absolute -right-[17vw] -bottom-[20vh] h-[67vh] w-[58vw] bg-collage-red sm:-right-[8vw] sm:w-[42vw]"
            style={{
              clipPath:
                'polygon(10% 4%, 62% 0, 96% 15%, 90% 44%, 100% 72%, 80% 100%, 38% 94%, 0 100%, 6% 55%, 0 24%)',
            }}
            initial={{ x: '105%', rotate: 10 }}
            animate={{ x: 0, rotate: 5 }}
            transition={{ duration: 0.5, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
          />

          <motion.div
            className="torn-strip absolute inset-x-[-8%] top-[52%] h-14 -rotate-3 bg-collage-yellow sm:h-20"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.42, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.div
            className="relative z-10 mx-auto flex w-[84vw] max-w-3xl items-center justify-center gap-3 sm:gap-7"
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.08, delayChildren: 0.22 }}
          >
            <motion.div variants={logoPart} className="shrink-0">
              <Image
                src="/logo-mark.png"
                alt=""
                priority
                width={512}
                height={512}
                className="h-20 w-20 drop-shadow-[5px_6px_0_rgba(27,17,12,0.14)] sm:h-32 sm:w-32"
              />
            </motion.div>
            <motion.div variants={logoPart} className="min-w-0">
              <Image
                src="/wordmark.png"
                alt=""
                priority
                width={949}
                height={322}
                className="h-auto w-full max-w-xl drop-shadow-[5px_6px_0_rgba(27,17,12,0.1)]"
              />
            </motion.div>
          </motion.div>

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
  )
}
