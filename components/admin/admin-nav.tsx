'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminSections } from '@/components/admin/admin-sections'

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {adminSections.map((section) => (
        <div
          key={section.label}
          className={cn('relative overflow-hidden rounded-xl border p-3 pt-4', section.tone.tile)}
        >
          <span className={cn('absolute inset-x-0 top-0 h-1', section.tone.bar)} aria-hidden />
          <p className="mb-2 flex items-center gap-1.5 px-2 text-[0.65rem] font-bold tracking-[0.2em] text-ink uppercase">
            <span className={cn('h-2 w-2 rounded-full', section.tone.bar)} aria-hidden />
            {section.label}
          </p>
          <ul className="flex flex-wrap gap-1">
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
        </div>
      ))}
    </nav>
  )
}
