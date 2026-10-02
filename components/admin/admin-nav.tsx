'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminSections } from '@/components/admin/admin-sections'

// Each section begins as its icon, then opens in sequence. It can also be
// toggled independently without changing the one-click access to every page.
export function AdminNav() {
  const pathname = usePathname()
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const timers = adminSections.map((section, index) =>
      window.setTimeout(() => {
        setOpenSections((current) => new Set([...current, section.label]))
      }, 120 + index * 140),
    )

    return () => timers.forEach(window.clearTimeout)
  }, [])

  function toggleSection(label: string) {
    setOpenSections((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
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
          const isOpen = openSections.has(section.label)
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
                title={section.label}
                aria-expanded={isOpen}
                aria-controls={sectionId}
                onClick={() => toggleSection(section.label)}
                className={cn(
                  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full',
                  'transition-transform focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none',
                  isOpen && 'scale-100',
                  section.tone.badge,
                )}
              >
                <SectionIcon className="h-4 w-4" aria-hidden />
                <span className="sr-only">{section.label}</span>
              </button>
              <div
                className={cn(
                  'grid min-w-0 transition-[grid-template-columns,opacity] duration-500 ease-out motion-reduce:transition-none',
                  isOpen ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0',
                )}
              >
                <ul id={sectionId} className="flex min-w-0 overflow-hidden items-center gap-1" aria-label={`Sección ${section.label}`}>
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
                            'transition-colors focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none',
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
              </div>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
