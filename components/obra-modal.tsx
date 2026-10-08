'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ArtworkSummary } from '@/lib/finalists'
import { toSummary } from '@/lib/obra-detail'

// Clicking an obra in a list (the home's collage, the map, the search, an
// artist's page) opens it in a popup over that list instead of leaving it.
// The address still changes to /obras/<slug>, so the link can be copied, a
// reload shows the full page, and the phone's Back button closes the popup.
// The popup reads its data from a CDN-cached endpoint (app/api/obras/[slug]),
// so opening an obra costs no page render on the server.

// The history entry of an obra open in the popup carries the card it was
// opened from; Back and Forward land on it (popstate) and show it again.
const ENTRY_KEY = 'obraPopup'

function popupEntry(): ArtworkSummary | undefined {
  return window.history.state?.[ENTRY_KEY] ?? undefined
}

// Whether the current address is an obra open in the popup, which leaves the
// page under it untouched (components/route-transition.tsx).
export function isObraPopupEntry(): boolean {
  return popupEntry() !== undefined
}

const loadPopup = () => import('@/components/obra-popup')
const ObraPopup = dynamic(() => loadPopup().then((module) => module.ObraPopup), {
  ssr: false,
  // The popup's dimmed backdrop, in case its code is still on the way.
  loading: () => <div className="fixed inset-0 z-50 bg-ink/70" aria-hidden="true" />,
})

const OpenObraContext = createContext<((obra: ArtworkSummary) => void) | null>(null)

// Opens an obra in the popup; null outside ObraModalProvider.
export function useOpenObra() {
  return useContext(OpenObraContext)
}

export function ObraModalProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [obra, setObra] = useState<ArtworkSummary | null>(null)
  const [seenPathname, setSeenPathname] = useState(pathname)
  const returnFocus = useRef<HTMLElement | null>(null)

  // A link followed from inside the popup (the artist, the store) leaves it.
  if (pathname !== seenPathname) {
    setSeenPathname(pathname)
    if (obra && pathname !== `/obras/${obra.slug}`) setObra(null)
  }

  useEffect(() => {
    // Reloading keeps the entry's state but shows the full page: forget the
    // popup so going Back and Forward again doesn't open it over that page.
    if (isObraPopupEntry()) window.history.replaceState({ ...window.history.state, [ENTRY_KEY]: undefined }, '')
    const onPopState = (event: PopStateEvent) => setObra(event.state?.[ENTRY_KEY] ?? null)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const open = useCallback((next: ArtworkSummary) => {
    const entry = { [ENTRY_KEY]: toSummary(next) }
    const href = `/obras/${next.slug}`
    // Another obra chosen inside the popup takes this one's place, so Back
    // always returns to the list in one step.
    if (isObraPopupEntry()) {
      window.history.replaceState(entry, '', href)
    } else {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      window.history.pushState(entry, '', href)
    }
    setObra(next)
  }, [])

  const close = useCallback(() => {
    if (isObraPopupEntry()) window.history.back()
    else setObra(null)
  }, [])

  return (
    <OpenObraContext.Provider value={open}>
      {children}
      {obra && <ObraPopup obra={obra} onClose={close} returnFocus={returnFocus} />}
    </OpenObraContext.Provider>
  )
}

// A link to an obra that opens it in the popup. Opening it in a new tab or
// window (middle click, Ctrl/Cmd+click) still goes to the full page.
export function ObraLink({
  obra,
  onClick,
  onPointerEnter,
  onFocus,
  ...props
}: Omit<React.ComponentProps<typeof Link>, 'href' | 'prefetch'> & { obra: ArtworkSummary }) {
  const open = useOpenObra()
  return (
    <Link
      {...props}
      href={`/obras/${obra.slug}`}
      // The popup doesn't need the page: prefetching it would only spend a
      // request (and proxy.ts's CPU) for every obra in view.
      prefetch={false}
      // The popup's code arrives while the pointer or focus reaches the card.
      onPointerEnter={(event) => { void loadPopup(); onPointerEnter?.(event) }}
      onFocus={(event) => { void loadPopup(); onFocus?.(event) }}
      onClick={(event) => {
        onClick?.(event)
        if (!open || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        open(obra)
      }}
    />
  )
}
