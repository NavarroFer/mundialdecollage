'use client'

import { MessageCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { consultLink } from '@/lib/club-contact'
import { fmt } from '@/lib/i18n/format'
import { useI18n } from '@/lib/i18n/client'
import { useClubHostStore, type ClubHostInfo } from './host'

// The host's welcome letter: the gallery's title, its room text and a way to
// write to the artist, on a sheet of paper.
export function WelcomeLetter({ host }: { host: ClubHostInfo }) {
  const open = useClubHostStore((state) => state.open)
  const { m } = useI18n()
  const t = m.gallery.clubHost
  const write = consultLink(host.contact, fmt(t.message, { title: host.title }))

  return (
    <Dialog open={open} onOpenChange={(next) => useClubHostStore.getState().setOpen(next)}>
      <DialogContent className="max-h-[85dvh] max-w-lg -rotate-[0.6deg] overflow-y-auto rounded-sm border-2 border-ink/15 bg-[#f6efdf] p-7 text-ink shadow-[6px_8px_0_rgba(27,17,12,0.2)] sm:p-9">
        <p className="text-xs font-bold tracking-[0.2em] text-collage-red uppercase">{t.eyebrow}</p>
        <DialogTitle className="font-display mt-2 text-3xl leading-tight uppercase">{host.title}</DialogTitle>
        <p className="mt-5 whitespace-pre-line font-serif text-lg leading-relaxed">{host.statement?.trim() || t.fallback}</p>
        <p className="mt-6 text-right font-serif text-lg italic">— {host.artistName}</p>
        {write && (
          <a href={write} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-5 text-sm font-bold">
            <MessageCircle className="size-4" aria-hidden="true" />
            {t.write}
          </a>
        )}
      </DialogContent>
    </Dialog>
  )
}
