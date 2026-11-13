'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Compass, Eye, House, Landmark, Plus, Search, type LucideIcon } from 'lucide-react'
import { SectionLink } from '@/components/section-link'
import { track } from '@/lib/track'
import type { FunnelEvent } from '@/lib/funnel'
import './mobile-tab-bar.css'

export type MobileTabBarLabels = {
  nav: string
  home: string
  explore: string
  participate: string
  show: string
  mundial: string
  opensInNewTab: string
}

type Tab = {
  key: 'home' | 'explore' | 'participate' | 'show' | 'mundial'
  href: string
  label: string
  icon: LucideIcon
  event?: FunnelEvent
  // A section of the home (scrolled to when already there).
  sectionId?: string
  newTab?: boolean
}

// How far a finger travels before a press becomes a drag across the tabs.
const DRAG_SLOP = 8

function activeTab(pathname: string): Tab['key'] | null {
  if (pathname.startsWith('/explorar')) return 'explore'
  if (pathname.startsWith('/muestra') || pathname.startsWith('/galeria-3d') || pathname.startsWith('/museomar')) return 'show'
  if (pathname.startsWith('/mundial') || pathname.startsWith('/club') || pathname.startsWith('/tienda') || pathname.startsWith('/revista')) return 'mundial'
  if (pathname.startsWith('/onboarding')) return 'participate'
  if (pathname === '/') return 'home'
  return null
}

// The phone's navigation, like Instagram's: five tabs along the bottom with
// «Participar» raised in the middle. A finger can press one and slide across
// the others; a lens follows it and the tab under it on release is the one
// that opens. A plain tap is just the link's own click.
export function MobileTabBar({ callOpen, showParticipate = true, labels }: { callOpen: boolean; showParticipate?: boolean; labels: MobileTabBarLabels }) {
  const pathname = usePathname()
  const rowRef = useRef<HTMLDivElement>(null)
  const lensRef = useRef<HTMLSpanElement>(null)
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const drag = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean; index: number } | null>(null)
  // The release already opened a tab; the click the browser may send after it must not open another.
  const swallowClick = useRef(false)
  const [hovered, setHovered] = useState<number | null>(null)
  // Shown as selected from the tap until the route catches up (or briefly, for a tab that stays on this page).
  const [chosen, setChosen] = useState<{ index: number; path: string; n: number } | null>(null)
  const tabs: Tab[] = [
    { key: 'home', href: '/', label: labels.home, icon: House },
    { key: 'explore', href: '/explorar', label: labels.explore, icon: Search },
    ...(showParticipate ? [callOpen
      ? { key: 'participate' as const, href: '/onboarding', label: labels.participate, icon: Plus, event: 'submit_click_tabbar' as const }
      : { key: 'participate' as const, href: '/galeria-3d', label: labels.participate, icon: Eye, event: 'submit_click_tabbar' as const }] : []),
    { key: 'show', href: '/muestra', label: labels.show, icon: Landmark, event: 'gallery_click_tabbar' },
    { key: 'mundial', href: '/mundial', label: labels.mundial, icon: Compass },
  ]

  const activeKey = activeTab(pathname)
  const activeIndex = tabs.findIndex((tab) => tab.key === activeKey)
  const chosenIndex = chosen && chosen.path === pathname ? chosen.index : null
  const restIndex = chosenIndex ?? (activeIndex >= 0 ? activeIndex : null)
  const dragging = hovered !== null

  // The lens rests on the selected tab; a drag moves it by hand (see onPointerMove).
  useLayoutEffect(() => {
    const lens = lensRef.current
    if (!lens || dragging) return
    if (restIndex === null) {
      lens.style.opacity = '0'
      return
    }
    lens.style.opacity = '1'
    lens.style.transform = `translateX(calc(${restIndex} * (100% + 0.5rem))) scale(1)`
  }, [restIndex, dragging])

  function indexAt(clientX: number): number {
    const row = rowRef.current
    if (!row) return 0
    const rect = row.getBoundingClientRect()
    return Math.min(tabs.length - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * tabs.length)))
  }

  function moveLensTo(clientX: number) {
    const row = rowRef.current
    const lens = lensRef.current
    if (!row || !lens) return
    const rect = row.getBoundingClientRect()
    const step = rect.width / tabs.length
    const x = Math.min(rect.width - step, Math.max(0, clientX - rect.left - step / 2))
    lens.style.opacity = '1'
    lens.style.transform = `translateX(${x}px) scale(1.12, 1.18)`
  }

  function onTabClick(index: number) {
    const tab = tabs[index]
    if (tab.event) track(tab.event)
    setChosen((previous) => ({ index, path: pathname, n: (previous?.n ?? 0) + 1 }))
    // These stay on this page (a new tab, or a scroll down the home), so the
    // selection goes back to the route's own once the pop is over.
    if (tab.newTab || (tab.sectionId && pathname === '/')) window.setTimeout(() => setChosen(null), 450)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    // The slide is a touch gesture; a mouse just clicks.
    if (event.pointerType === 'mouse' || !event.isPrimary) return
    swallowClick.current = false
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, index: indexAt(event.clientX) }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    if (!current.moved) {
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_SLOP) return
      current.moved = true
      // Keeps the events coming even when the finger strays above the bar.
      event.currentTarget.setPointerCapture(event.pointerId)
      setHovered(current.index)
    }
    moveLensTo(event.clientX)
    const index = indexAt(event.clientX)
    if (index !== current.index) {
      current.index = index
      setHovered(index)
      if ('vibrate' in navigator) navigator.vibrate(6)
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    drag.current = null
    if (!current.moved) return
    setHovered(null)
    // The link's own click: tracking, client navigation, a new tab for the gallery.
    linkRefs.current[current.index]?.click()
    swallowClick.current = true
  }

  function onPointerCancel() {
    drag.current = null
    setHovered(null)
  }

  return (
    <nav
      aria-label={labels.nav}
      className="mobile-tab-bar fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      data-dragging={dragging}
      data-tabs={tabs.length}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={(event) => {
        if (!swallowClick.current) return
        swallowClick.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <div ref={rowRef} className={`relative mx-auto grid h-16 max-w-md ${showParticipate ? 'grid-cols-5' : 'grid-cols-4'}`}>
        <span ref={lensRef} aria-hidden="true" className="mobile-tab-bar__lens" />
        {tabs.map((tab, index) => {
          const Icon = tab.icon
          const featured = tab.key === 'participate'
          const active = index === activeIndex
          const lit = dragging ? hovered === index : index === restIndex
          // SectionLink scrolls to the home's section when already there.
          const TabLink = tab.sectionId ? SectionLink : Link
          return (
            <TabLink
              key={tab.key}
              ref={(element) => { linkRefs.current[index] = element }}
              href={tab.href}
              prefetch={false}
              target={tab.newTab ? '_blank' : undefined}
              rel={tab.newTab ? 'noopener noreferrer' : undefined}
              aria-current={active ? 'page' : undefined}
              draggable={false}
              onClick={() => onTabClick(index)}
              data-lit={lit}
              data-featured={featured}
              className="mobile-tab-bar__tab"
            >
              <span key={chosenIndex === index ? `pop-${chosen?.n}` : 'idle'} className="mobile-tab-bar__icon" data-pop={chosenIndex === index}>
                <Icon className={featured ? 'size-6' : 'size-[1.375rem]'} strokeWidth={lit || featured ? 2.4 : 1.9} aria-hidden="true" />
              </span>
              <span className="mobile-tab-bar__label">{tab.label}</span>
              {tab.newTab && <span className="sr-only"> {labels.opensInNewTab}</span>}
            </TabLink>
          )
        })}
      </div>
    </nav>
  )
}
