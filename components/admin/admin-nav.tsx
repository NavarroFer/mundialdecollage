'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminSections } from '@/components/admin/admin-sections'

export function AdminNav() {
  const pathname = usePathname()
  const [minimizedSections, setMinimizedSections] = useState<string[]>([])

  function toggleSection(label: string) {
    setMinimizedSections((current) =>
      current.includes(label) ? current.filter((section) => section !== label) : [...current, label],
    )
  }

  return (
    <nav className="flex flex-wrap items-stretch gap-3">
      {adminSections.map((section) => {
        const isMinimized = minimizedSections.includes(section.label)
        const sectionId = `admin-section-${section.label.toLowerCase().replaceAll(' ', '-')}`

        return (
          <div
            key={section.label}
            className={cn(
              'relative overflow-hidden rounded-xl border',
              'min-h-48 transition-[width,flex-basis] duration-200 ease-out',
              isMinimized ? 'w-24 self-stretch max-sm:min-h-20 max-sm:w-full' : 'min-w-64 flex-1 p-3 pt-4',
              section.tone.tile,
            )}
          >
            {isMinimized ? (
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                aria-expanded={false}
                aria-controls={sectionId}
                aria-label={`Expandir ${section.label}`}
                className="flex size-full items-center justify-center p-2 text-center text-[0.65rem] font-bold leading-tight tracking-[0.16em] text-ink uppercase transition-colors hover:bg-ink/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/50 focus-visible:outline-none"
              >
                {section.label}
              </button>
            ) : (
              <>
                <span className={cn('absolute inset-x-0 top-0 h-1', section.tone.bar)} aria-hidden />
                <div className="mb-2 flex items-center justify-between gap-2 px-2">
                  <p className="flex items-center gap-1.5 text-[0.65rem] font-bold tracking-[0.2em] text-ink uppercase">
                    <span className={cn('h-2 w-2 rounded-full', section.tone.bar)} aria-hidden />
                    {section.label}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    aria-expanded
                    aria-controls={sectionId}
                    aria-label={`Minimizar ${section.label}`}
                    title="Minimizar panel"
                    className="rounded-md p-1 text-ink/60 transition-colors hover:bg-ink/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              <ul id={sectionId} className="flex flex-wrap gap-1">
                {section.items.map((item) => {
                  const isActive = !item.external && pathname?.startsWith(item.href)
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        {...(item.external && { target: '_blank', rel: 'noopener noreferrer' })}
                        aria-current={isActive ? 'page' : undefined}
                        title={item.description ?? (item.external ? 'Se abre en otra pestaña' : undefined)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors',
                          isActive ? section.tone.active : cn('text-ink/70', section.tone.hover),
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                        {item.external && <ArrowUpRight className="h-3 w-3 opacity-60" />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
              </>
            )}
          </div>
        )
      })}
    </nav>
  )
}
