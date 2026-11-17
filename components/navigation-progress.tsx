'use client'

import { useEffect, useRef, useState } from 'react'

// A bar along the top of the screen from the moment a link to another page is
// pressed until that page is on screen. On a slow phone, or a page that has
// to be built, the wait used to show nothing at all and the site looked
// frozen. Next's router commits a navigation with history.pushState /
// replaceState (Back and Forward with popstate), so that's what ends it; a
// download or a link something else intercepted ends on the timeout. Only
// browser code: nothing renders per request.

type Phase = 'idle' | 'loading' | 'done'

// Longest a bar stays up when nothing ever commits (a link another handler
// took over, a file the browser downloads).
const GIVE_UP_MS = 10_000
// How long the full bar stays before it fades.
const DONE_MS = 250

const urlWithoutHash = (url: string) => url.split('#')[0]

// Same-tab navigation to another page of the site: not a new tab, not a
// download, not a jump within the page, not a file.
export function leadsToAnotherPage(anchor: HTMLAnchorElement, event: MouseEvent, current: string): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (anchor.target && anchor.target !== '_self') return false
  if (anchor.hasAttribute('download')) return false
  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false
  let url: URL
  try {
    url = new URL(anchor.href, current)
  } catch {
    return false
  }
  const here = new URL(current)
  if (url.origin !== here.origin) return false
  if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return false
  return urlWithoutHash(url.href) !== urlWithoutHash(here.href)
}

export function NavigationProgress() {
  const [phase, setPhase] = useState<Phase>('idle')
  const startedFrom = useRef<string | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clearTimers = () => {
      for (const id of timers.current) window.clearTimeout(id)
      timers.current = []
    }
    const finish = () => {
      if (startedFrom.current === null) return
      startedFrom.current = null
      clearTimers()
      setPhase('done')
      timers.current.push(window.setTimeout(() => setPhase('idle'), DONE_MS))
    }
    const start = () => {
      clearTimers()
      startedFrom.current = urlWithoutHash(window.location.href)
      setPhase('loading')
      timers.current.push(window.setTimeout(finish, GIVE_UP_MS))
    }
    // Ends once the address actually moved: the router also calls
    // replaceState for its own bookkeeping on the same page.
    const settle = () => {
      if (startedFrom.current !== null && urlWithoutHash(window.location.href) !== startedFrom.current) finish()
    }

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a')
      if (anchor instanceof HTMLAnchorElement && leadsToAnotherPage(anchor, event, window.location.href)) start()
    }

    const { pushState, replaceState } = window.history
    window.history.pushState = function (...args: Parameters<History['pushState']>) {
      pushState.apply(this, args)
      settle()
    }
    window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
      replaceState.apply(this, args)
      settle()
    }
    const onPopState = () => finish()

    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPopState)
    // Leaving for another document (a full reload): this page goes away.
    window.addEventListener('pagehide', finish)
    return () => {
      clearTimers()
      window.history.pushState = pushState
      window.history.replaceState = replaceState
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('pagehide', finish)
    }
  }, [])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[2147483647] h-[3px]">
      <div
        data-phase={phase}
        className="navigation-progress h-full origin-left bg-collage-blue shadow-[0_0_8px_var(--collage-blue)]"
      />
    </div>
  )
}
