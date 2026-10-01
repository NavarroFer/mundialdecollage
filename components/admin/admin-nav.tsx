'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminSections } from '@/components/admin/admin-sections'

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegación de administración" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {adminSections.map((section) => {
        const hasActiveItem = section.items.some(
          (item) => !item.external && pathname?.startsWith(item.href),
        )

        return (
          <section
            key={section.label}
            className={cn(
              'relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm',
              'transition-shadow duration-200 hover:shadow-md',
              hasActiveItem && 'ring-1 ring-ink/15',
              section.tone.tile,
            )}
          >
            <span className={cn('absolute inset-x-0 top-0 h-1', section.tone.bar)} aria-hidden />
            <h2 className="mb-2.5 flex items-center gap-2 pt-1 text-[0.65rem] font-bold tracking-[0.2em] text-ink uppercase">
              <span className={cn('h-2 w-2 rounded-full', section.tone.bar)} aria-hidden />
              {section.label}
            </h2>
            <ul className="grid gap-1.5" aria-label={`Sección ${section.label}`}>
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
                        'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold leading-tight',
                        'transition-colors focus-visible:ring-2 focus-visible:ring-ink/50 focus-visible:outline-none',
                        isActive
                          ? section.tone.active
                          : cn('bg-card/70 text-ink/75', section.tone.hover),
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1">{item.label}</span>
                      {item.external && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </nav>
  )
}
