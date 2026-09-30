'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Minus, Plus } from 'lucide-react'
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
    <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {adminSections.map((section) => {
        const isMinimized = minimizedSections.includes(section.label)
        const sectionId = `admin-section-${section.label.toLowerCase().replaceAll(' ', '-')}`

        return (
          <div
            key={section.label}
            className={cn('relative overflow-hidden rounded-xl border p-3 pt-4', section.tone.tile)}
          >
            <span className={cn('absolute inset-x-0 top-0 h-1', section.tone.bar)} aria-hidden />
            <div className={cn('flex items-center justify-between gap-2 px-2', !isMinimized && 'mb-2')}>
              <p className="flex items-center gap-1.5 text-[0.65rem] font-bold tracking-[0.2em] text-ink uppercase">
                <span className={cn('h-2 w-2 rounded-full', section.tone.bar)} aria-hidden />
                {section.label}
              </p>
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                aria-expanded={!isMinimized}
                aria-controls={sectionId}
                aria-label={isMinimized ? `Expandir ${section.label}` : `Minimizar ${section.label}`}
                title={isMinimized ? 'Expandir panel' : 'Minimizar panel'}
                className="rounded-md p-1 text-ink/60 transition-colors hover:bg-ink/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none"
              >
                {isMinimized ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </button>
            </div>
            {!isMinimized && (
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
            )}
          </div>
        )
      })}
    </nav>
  )
}
