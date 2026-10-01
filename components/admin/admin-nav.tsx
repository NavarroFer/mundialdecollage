'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminSections } from '@/components/admin/admin-sections'

// One compact strip: every destination stays one click away. Wraps on
// desktop, scrolls sideways on phones instead of stacking into tall tiles.
export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación de administración"
      className="-mx-5 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      <div className="flex w-max items-center gap-x-4 gap-y-2.5 lg:w-auto lg:flex-wrap">
        {adminSections.map((section, index) => {
          const hasActiveItem = section.items.some(
            (item) => !item.external && pathname?.startsWith(item.href),
          )

          return (
            <div
              key={section.label}
              className={cn(
                'flex items-center gap-2',
                index > 0 && 'border-l border-ink/10 pl-4',
              )}
            >
              <span
                className={cn(
                  'flex items-center gap-1.5 text-[0.6rem] font-bold tracking-[0.18em] uppercase',
                  hasActiveItem ? 'text-ink' : 'text-muted-foreground',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', section.tone.bar)} aria-hidden />
                {section.label}
              </span>
              <ul className="flex items-center gap-1" aria-label={`Sección ${section.label}`}>
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
                          'flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap',
                          'transition-colors focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none',
                          isActive ? section.tone.active : cn('text-ink/70', section.tone.hover),
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
          )
        })}
      </div>
    </nav>
  )
}
