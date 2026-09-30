'use client'

import { useEffect, useState, type ReactNode } from 'react'

export function SiteHeaderMotion({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let frame: number | undefined
    const update = () => {
      frame = undefined
      setScrolled(window.scrollY > 48)
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
      className="group/header sticky top-0 z-50 border-b-2 border-ink/10 bg-paper/95 backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-300 ease-out data-[scrolled=true]:border-ink/15 data-[scrolled=true]:bg-paper data-[scrolled=true]:shadow-[0_8px_24px_color-mix(in_srgb,var(--ink)_8%,transparent)] motion-reduce:transition-none"
    >
      {children}
    </header>
  )
}
