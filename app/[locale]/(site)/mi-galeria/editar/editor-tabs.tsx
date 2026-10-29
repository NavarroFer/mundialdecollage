'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type EditorTab = { id: string; label: string; icon: React.ReactNode; badge?: string | number; content: React.ReactNode }

// One section of the editor at a time, so the page is a dashboard instead of
// a long scroll. The open tab lives in the URL's hash: the editor's actions
// redirect back to #obras, #casa…, and «Resumen» links jump the same way.
// A tab is mounted the first time it opens and then kept, so a half-filled
// form survives switching tabs and the map loads only when someone wants it.
export function EditorTabs({ tabs, label }: { tabs: EditorTab[]; label: string }) {
  const [active, setActive] = useState(tabs[0].id)
  const [opened, setOpened] = useState(() => new Set([tabs[0].id]))

  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.slice(1)
      if (!tabs.some((tab) => tab.id === id)) return
      setActive(id)
      setOpened((previous) => (previous.has(id) ? previous : new Set(previous).add(id)))
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [tabs])

  return (
    <div>
      <nav aria-label={label} className="sticky top-0 z-10 -mx-5 bg-background/90 px-5 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:px-2">
        <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((tab) => (
            <li key={tab.id} className="shrink-0">
              <a
                href={`#${tab.id}`}
                aria-current={active === tab.id ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
                  active === tab.id ? 'bg-ink text-white' : 'text-ink hover:bg-muted',
                )}
              >
                <span className="[&_svg]:h-4 [&_svg]:w-4">{tab.icon}</span>
                {tab.label}
                {tab.badge !== undefined && tab.badge !== 0 && (
                  <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active === tab.id ? 'bg-white/20' : 'bg-collage-yellow text-ink')}>{tab.badge}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {tabs.map((tab) => (
        <div key={tab.id} className={cn('mt-6', active !== tab.id && 'hidden')}>
          {opened.has(tab.id) && tab.content}
        </div>
      ))}
    </div>
  )
}
