'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { isObraPopupEntry } from '@/components/obra-modal'

// Animate the arriving page without delaying navigation or remounting its state.
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const previousPath = useRef(pathname)
  const container = useRef<HTMLDivElement>(null)
  const wasPopup = useRef(false)

  useLayoutEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    // Opening, switching or closing an obra's popup (components/obra-modal.tsx)
    // changes the address but not the page under it.
    const popup = isObraPopupEntry()
    const touchesPopup = popup || wasPopup.current
    wasPopup.current = popup
    const element = container.current
    if (touchesPopup || !element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const animation = element.animate(
      [{ opacity: 0.35 }, { opacity: 1 }],
      { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
    return () => animation.cancel()
  }, [pathname])

  return <div ref={container}>{children}</div>
}
