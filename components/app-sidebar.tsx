'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, House, Landmark, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AppNavLabels = {
  home: string
  explore: string
  show: string
  mundial: string
  participate: string
}

const ITEMS = [
  { href: '/', key: 'home', icon: House },
  { href: '/explorar', key: 'explore', icon: Search },
  { href: '/muestra', key: 'show', icon: Landmark },
  { href: '/mundial', key: 'mundial', icon: Compass },
  { href: '/onboarding', key: 'participate', icon: Plus },
] as const

export function AppSidebar({ labels, showParticipate = true }: { labels: AppNavLabels; showParticipate?: boolean }) {
  const pathname = usePathname()
  const items = showParticipate ? ITEMS : ITEMS.filter((item) => item.key !== 'participate')
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-2 border-ink/10 bg-paper px-4 py-6 lg:flex">
      <Link href="/" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue">
        <Image src="/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10" />
        <Image src="/wordmark.png" alt="Mundial de Collage" width={120} height={40} className="h-7 w-auto" />
      </Link>
      <nav aria-label={labels.home} className="mt-8 flex flex-col gap-1">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
            || (item.href === '/muestra' && (pathname.startsWith('/galeria-3d') || pathname.startsWith('/museomar')))
            || (item.href === '/mundial' && (pathname.startsWith('/club') || pathname.startsWith('/tienda') || pathname.startsWith('/revista')))
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue',
                active ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {labels[item.key]}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
