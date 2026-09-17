'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, FileText, Send, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin/contactos', label: 'Contactos', icon: Users },
  { href: '/admin/plantillas', label: 'Plantillas', icon: FileText },
  { href: '/admin/campanas', label: 'Campañas', icon: Send },
  { href: '/admin/inscripciones', label: 'Inscripciones', icon: ClipboardList },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2">
      {navItems.map((item) => {
        const isActive = pathname?.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-collage-blue text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-card hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
