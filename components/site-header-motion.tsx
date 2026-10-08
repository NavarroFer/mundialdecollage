'use client'

import { useEffect, useState, type ReactNode } from 'react'

// How far the page has to move in one direction before the header reacts,
// so a finger's jitter doesn't make it flicker.
const DIRECTION_SLOP = 6
// Near the top the header always shows.
const ALWAYS_SHOWN_ABOVE = 80

export function SiteHeaderMotion({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  // Phones only (see the classes below): scrolling down slides the header
  // away, scrolling up brings it back. The tab bar stays put.
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let frame: number | undefined
    let anchor = window.scrollY
    const update = () => {
      frame = undefined
      const y = window.scrollY
      setScrolled(y > 48)
      if (y <= ALWAYS_SHOWN_ABOVE) {
        setHidden(false)
        anchor = y
        return
      }
      if (y - anchor > DIRECTION_SLOP) {
        setHidden(true)
        anchor = y
      } else if (anchor - y > DIRECTION_SLOP) {
        setHidden(false)
        anchor = y
      }
    }
    const onScroll = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <header
      data-scrolled={scrolled}
      data-hidden={hidden}
      className="group/header sticky top-0 z-50 border-b-2 border-ink/10 bg-paper/95 backdrop-blur-sm transition-[background-color,border-color,box-shadow,translate] duration-300 ease-out data-[scrolled=true]:border-ink/15 data-[scrolled=true]:bg-paper data-[scrolled=true]:shadow-[0_8px_24px_color-mix(in_srgb,var(--ink)_8%,transparent)] max-lg:data-[hidden=true]:-translate-y-full max-lg:data-[hidden=true]:shadow-none motion-reduce:transition-none"
    >
      {children}
    </header>
  )
}
