'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { adminSectionFor } from '@/components/admin/admin-sections'

// Paints the eyebrow in the color of the menu section the page belongs to,
// so the header and the highlighted menu tile read as the same place.
// With href it becomes a link to the public page the section is about
// (opened in a new tab so the admin stays where it was).
export function SectionEyebrow({ children, href }: { children: React.ReactNode; href?: string }) {
  const section = adminSectionFor(usePathname())
  const className = cn(
    'inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-[0.2em] uppercase',
    section ? section.tone.badge : 'bg-collage-red text-paper',
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(className, 'transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none')}
      >
        {children}
      </a>
    )
  }

  return <p className={className}>{children}</p>
}
