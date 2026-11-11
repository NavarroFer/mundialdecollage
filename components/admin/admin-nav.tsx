'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminSectionFor, adminSections, isAdminGroupOpen } from '@/components/admin/admin-sections'

// Groups stay closed until the admin opens one, except the group of the
// page they're on. The names stay visible either way, so the bar is a short
// list of areas instead of every destination at once.
export function AdminNav() {
  const pathname = usePathname()
  const activeLabel = adminSectionFor(pathname)?.label
  const [opened, setOpened] = useState<Set<string>>(() => new Set())
  const [closed, setClosed] = useState<Set<string>>(() => new Set())

  function toggleSection(label: string) {
    const isOpen = isAdminGroupOpen(label, activeLabel, opened, closed)
    if (isOpen) {
      setOpened((current) => { const next = new Set(current); next.delete(label); return next })
      setClosed((current) => new Set([...current, label]))
    } else {
      setClosed((current) => { const next = new Set(current); next.delete(label); return next })
      setOpened((current) => new Set([...current, label]))
    }
  }

  return (
    <nav
      aria-label="Navegación de administración"
      className="-mx-5 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      <div className="flex w-max items-center gap-2 lg:w-auto lg:flex-wrap">
        {adminSections.map((section) => {
          const hasActiveItem = section.items.some(
            (item) => !item.external && pathname?.startsWith(item.href),
          )
          const SectionIcon = section.icon
          const isOpen = isAdminGroupOpen(section.label, activeLabel, opened, closed)
          const sectionId = `admin-nav-${section.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

          return (
            <div
              key={section.label}
              className={cn(
                'flex items-center gap-1.5 rounded-full border p-1',
                section.tone.tile,
                hasActiveItem && 'shadow-sm ring-1 ring-ink/10',
              )}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={sectionId}
                onClick={() => toggleSection(section.label)}
                className={cn(
                  'flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5',
                  'focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none',
                  section.tone.badge,
                )}
              >
                <SectionIcon className="h-4 w-4" aria-hidden />
                {section.label}
              </button>
              {isOpen && (
                <ul id={sectionId} className="flex items-center gap-1" aria-label={`Sección ${section.label}`}>
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
                            'flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap',
                            'focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none',
                            isActive ? section.tone.active : cn('text-ink/75', section.tone.hover),
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {item.label}
                          {item.external && <ArrowUpRight className="h-3 w-3 shrink-0 opacity-60" />}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
