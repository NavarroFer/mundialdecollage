'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { adminSectionFor } from '@/components/admin/admin-sections'

// Paints the eyebrow in the color of the menu section the page belongs to,
// so the header and the highlighted menu tile read as the same place.
export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  const section = adminSectionFor(usePathname())

  return (
    <p
      className={cn(
        'inline-block rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-[0.2em] uppercase',
        section ? section.tone.badge : 'bg-collage-red text-paper',
      )}
    >
      {children}
    </p>
  )
}
