'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/client'

// Once-per-tab flag — a fresh visit gets the intro, but a reload or
// back-navigation within the same session shouldn't replay it.
const SESSION_KEY = 'mdc-splash-seen'

// header.mp4 runs ~10s, too long to hold a splash screen open for, so we
// dismiss on a short fixed timer instead of waiting for the clip to finish.
// onEnded/onError stay wired as defensive triggers in case a shorter clip
// replaces this one later or playback fails outright.
const DISMISS_MS = 3200
const FADE_MS = 300

export function SplashScreen() {
  const [show, setShow] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const dismissedRef = useRef(false)
  const { m } = useI18n()

  useEffect(() => {
    function checkAndShow() {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) return

      try {
        if (sessionStorage.getItem(SESSION_KEY)) return
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // Safari private mode etc. can throw on read/write — fail open and
        // still show the splash once for this load rather than break.
      }

      setShow(true)
    }

    checkAndShow()
  }, [])

  function dismiss() {
    if (dismissedRef.current) return
    dismissedRef.current = true
    setLeaving(true)
    setTimeout(() => setShow(false), FADE_MS)
  }

  useEffect(() => {
    if (!show) return

    const timer = setTimeout(dismiss, DISMISS_MS)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [show])

  // The splash overlays the page visually, but the real content underneath
  // stays in the DOM — without this, Tab could still reach it while it's
  // hidden behind the splash. #site-content is the sibling wrapper in
  // app/page.tsx around everything except this component.
  useEffect(() => {
    const content = document.getElementById('site-content')
    content?.toggleAttribute('inert', show)
    return () => {
      content?.removeAttribute('inert')
    }
  }, [show])

  if (!show) return null

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-paper transition-opacity duration-300 ease-out ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <video
        src="/header.mp4"
        autoPlay
        muted
        playsInline
        onEnded={dismiss}
        onError={dismiss}
        aria-hidden="true"
        className="mix-blend-multiply h-auto w-[90vw] max-w-5xl sm:w-[70vw]"
      />
      <div className="grain-overlay pointer-events-none absolute inset-0" />
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-5 bottom-6 text-sm text-ink/60 underline-offset-4 hover:text-ink hover:underline sm:right-8"
      >
        {m.splash.skip}
      </button>
    </div>
  )
}
