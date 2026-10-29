'use client'

import { MessageCircle } from 'lucide-react'
import type { Artwork } from '@/data/artworks'
import { consultLink } from '@/lib/club-contact'
import { fmt } from '@/lib/i18n/format'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

/** A Club member's «consult about this work» button, when they gave a way to be reached. */
export function ArtworkContact({ artwork, className }: { artwork: Artwork; className?: string }) {
  const { m } = useI18n()
  const t = m.gallery.contact
  const href = consultLink(artwork.contact, fmt(t.message, { title: artwork.title }))
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-current px-4 text-sm font-bold', className)}
    >
      <MessageCircle className="size-4" aria-hidden="true" />
      {t.consult}
    </a>
  )
}
