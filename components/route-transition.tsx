'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Animate the arriving page without delaying navigation or remounting its state.
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const previousPath = useRef(pathname)
  const container = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    const element = container.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const animation = element.animate(
      [{ opacity: 0.35 }, { opacity: 1 }],
      { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
    return () => animation.cancel()
  }, [pathname])

  return <div ref={container}>{children}</div>
}
