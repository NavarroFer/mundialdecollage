'use client'

import { Instagram } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'

// The Instagram icon inside a participant pill: a 24px hit area around a
// 16px glyph, labelled with whose profile it opens.
export function InstagramIconLink({ href, name }: { href: string; name: string }) {
  const { m } = useI18n()
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={fmt(m.common.instagramOf, { name })}
      className="-my-1 -mr-2 rounded-full p-1 text-collage-red transition-colors hover:bg-collage-red/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-collage-blue"
    >
      <Instagram className="size-4" aria-hidden />
    </a>
  )
}
