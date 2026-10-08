'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Boxes, Eye, House, Plus, Store, Users, type LucideIcon } from 'lucide-react'
import { SectionLink } from '@/components/section-link'
import { track } from '@/lib/track'
import type { FunnelEvent } from '@/lib/funnel'
import './mobile-tab-bar.css'

export type MobileTabBarLabels = {
  nav: string
  home: string
  participants: string
  participate: string
  shop: string
  gallery3d: string
  opensInNewTab: string
}

type Tab = {
  key: 'home' | 'participants' | 'participate' | 'shop' | 'gallery'
  href: string
  label: string
  icon: LucideIcon
  event?: FunnelEvent
  // A section of the home (scrolled to when already there).
  sectionId?: string
  newTab?: boolean
}

const PARTICIPANTS_ID = 'participantes'
const CENTER = 2
// How far a finger travels before a press becomes a drag across the tabs.
const DRAG_SLOP = 8

function activeTab(pathname: string, participantsInView: boolean): Tab['key'] | null {
  if (pathname === '/') return participantsInView ? 'participants' : 'home'
  if (pathname.startsWith('/tienda')) return 'shop'
  if (pathname.startsWith('/onboarding')) return 'participate'
  return null
}

// The phone's navigation, like Instagram's: five tabs along the bottom with
// «Participar» raised in the middle. A finger can press one and slide across
// the others; a lens follows it and the tab under it on release is the one
// that opens. A plain tap is just the link's own click.
export function MobileTabBar({ callOpen, labels }: { callOpen: boolean; labels: MobileTabBarLabels }) {
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
  const [participantsInView, setParticipantsInView] = useState(false)

  const tabs: Tab[] = [
    { key: 'home', href: '/', label: labels.home, icon: House },
    { key: 'participants', href: `/#${PARTICIPANTS_ID}`, label: labels.participants, icon: Users, sectionId: PARTICIPANTS_ID },
    // «Participar» becomes «Ver las obras» once the call closes, as in the header.
    callOpen
      ? { key: 'participate', href: '/onboarding', label: labels.participate, icon: Plus, event: 'submit_click_tabbar' }
      : { key: 'participate', href: '/galeria-3d', label: labels.participate, icon: Eye, event: 'submit_click_tabbar' },
    { key: 'shop', href: '/tienda', label: labels.shop, icon: Store, event: 'store_click_tabbar' },
    { key: 'gallery', href: '/galeria-3d', label: labels.gallery3d, icon: Boxes, event: 'gallery_click_tabbar', newTab: true },
  ]

  const activeKey = activeTab(pathname, participantsInView)
  const activeIndex = tabs.findIndex((tab) => tab.key === activeKey)
  const chosenIndex = chosen && chosen.path === pathname ? chosen.index : null
  const restIndex = chosenIndex ?? (activeIndex >= 0 ? activeIndex : null)
  const dragging = hovered !== null

  // On the home, «Participantes» lights up while its section crosses the
  // middle of the screen, and «Inicio» the rest of the time.
  useEffect(() => {
    if (pathname !== '/') return
    const section = document.getElementById(PARTICIPANTS_ID)
    if (!section) return
    const observer = new IntersectionObserver(([entry]) => setParticipantsInView(entry.isIntersecting), {
      rootMargin: '-45% 0px -45% 0px',
    })
    observer.observe(section)
    return () => observer.disconnect()
  }, [pathname])

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
      <div ref={rowRef} className="relative mx-auto grid h-16 max-w-md grid-cols-5">
        <span ref={lensRef} aria-hidden="true" className="mobile-tab-bar__lens" />
        {tabs.map((tab, index) => {
          const Icon = tab.icon
          const featured = index === CENTER
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
