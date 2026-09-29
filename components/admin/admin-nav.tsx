'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  FileText,
  Send,
  ClipboardList,
  Images,
  BarChart3,
  MessageSquare,
  CreditCard,
  Boxes,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: typeof Images
  external?: boolean
}

// Groups match the eyebrows each admin page shows above its title.
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Convocatoria',
    items: [
      { href: '/admin/obras', label: 'Obras', icon: Images },
      { href: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
      { href: '/admin/pagos', label: 'Pagos', icon: CreditCard },
    ],
  },
  {
    label: 'Galería 3D',
    items: [
      { href: '/admin/comentarios', label: 'Comentarios', icon: MessageSquare },
      { href: '/galeria-3d', label: 'Recorrido', icon: Boxes, external: true },
    ],
  },
  {
    label: 'Taller',
    items: [{ href: '/admin/inscripciones', label: 'Inscripciones', icon: ClipboardList }],
  },
  {
    label: 'Newsletter',
    items: [
      { href: '/admin/contactos', label: 'Contactos', icon: Users },
      { href: '/admin/campanas', label: 'Campañas', icon: Send },
      { href: '/admin/plantillas', label: 'Plantillas', icon: FileText },
    ],
  },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-x-8 gap-y-5">
      {navGroups.map((group) => (
        <div key={group.label} className="min-w-0">
          <p className="mb-1.5 px-2.5 text-[0.65rem] font-bold tracking-[0.2em] text-muted-foreground/70 uppercase">
            {group.label}
          </p>
          <ul className="flex flex-wrap gap-1">
            {group.items.map((item) => {
              const isActive = !item.external && pathname?.startsWith(item.href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    {...(item.external && { target: '_blank', rel: 'noopener noreferrer' })}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-collage-blue/10 text-collage-blue'
                        : 'text-muted-foreground hover:bg-ink/5 hover:text-ink',
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
