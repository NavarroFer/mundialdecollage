'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { usePageView } from './view-settings'

export type StatsTab = { id: string; label: string; description: string; content: ReactNode }

/** The tab the arrow keys, Home and End move to (WAI-ARIA tabs), or null for any other key. */
export function tabAfterKey(ids: readonly string[], current: string, key: string): string | null {
  const index = ids.indexOf(current)
  if (key === 'ArrowRight') return ids.at((index + 1) % ids.length) ?? null
  if (key === 'ArrowLeft') return ids.at((index - 1 + ids.length) % ids.length) ?? null
  if (key === 'Home') return ids.at(0) ?? null
  if (key === 'End') return ids.at(-1) ?? null
  return null
}

// The page's charts split by area of the Mundial, one area at a time. Every
// tab is rendered on the server and stays mounted, only hidden: switching is
// instant, costs no request, and a chart's own settings survive it (charts
// measure themselves again when shown). The open tab lives in the URL's hash
// (#galeria), so a link opens it and the filters keep it (navigation.tsx).
export function StatsTabs({ tabs }: { tabs: StatsTab[] }) {
  const { settings } = usePageView()
  const ids = tabs.map((tab) => tab.id)
  const [active, setActive] = useState(ids[0])
  const baseId = useId()
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const idList = ids.join()

  useEffect(() => {
    const known = idList.split(',')
    const fromHash = () => {
      const id = window.location.hash.slice(1)
      if (known.includes(id)) setActive(id)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [idList])

  const open = (id: string) => {
    setActive(id)
    window.history.replaceState(window.history.state, '', `#${id}`)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const next = tabAfterKey(ids, active, event.key)
    if (!next) return
    event.preventDefault()
    open(next)
    buttons.current.get(next)?.focus()
  }

  return (
    <div className="mt-8">
      <div className="overflow-x-auto pb-1">
        <div role="tablist" aria-label="Áreas de las estadísticas" onKeyDown={onKeyDown} className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
          {tabs.map((tab) => {
            const selected = tab.id === active
            return (
              <button
                key={tab.id}
                ref={(node) => { if (node) buttons.current.set(tab.id, node); else buttons.current.delete(tab.id) }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => open(tab.id)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
                  selected ? 'bg-ink text-paper' : 'text-muted-foreground hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="mt-6 focus-visible:outline-none"
        >
          {settings.notes && <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{tab.description}</p>}
          {tab.content}
        </div>
      ))}
    </div>
  )
}

/** Charts that flow down two columns, each tile as tall as its own chart, so a short funnel and a long ranking sit side by side without a hole. */
export function StatsMasonry({ children }: { children: ReactNode }) {
  return <div className="gap-6 lg:columns-2 *:mb-6 *:break-inside-avoid">{children}</div>
}
