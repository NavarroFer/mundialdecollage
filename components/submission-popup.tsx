'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SubmitArtworkCta } from '@/components/submit-artwork-cta'
import { site } from '@/lib/site'
import { useI18n } from '@/lib/i18n/client'
import { fmt, formatDayMonth } from '@/lib/i18n/format'

const SEEN_KEY = 'mdc-submission-invitation-seen'
let shownThisVisit = false

export function SubmissionPopup() {
  const [open, setOpen] = useState(false)
  const { locale, m } = useI18n()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (shownThisVisit) return
      try {
        if (localStorage.getItem(SEEN_KEY)) return
        localStorage.setItem(SEEN_KEY, '1')
      } catch {
        // Keep the invitation usable when browser storage is unavailable.
      }
      shownThisVisit = true
      setOpen(true)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg p-7 pt-12 text-center sm:p-10" aria-describedby="submission-invitation-description">
        <p className="text-xs font-bold tracking-widest text-collage-blue uppercase">{m.popup.eyebrow}</p>
        <DialogTitle className="font-display mt-4 text-3xl uppercase sm:text-4xl">{m.popup.title}</DialogTitle>
        <p id="submission-invitation-description" className="mt-4 mb-7 text-muted-foreground">
          {fmt(m.popup.body, { date: formatDayMonth(locale, site.deadlineISO) })}
        </p>
        <SubmitArtworkCta />
        <button type="button" onClick={() => setOpen(false)} className="mx-auto mt-5 block min-h-11 text-sm text-muted-foreground underline underline-offset-4">{m.popup.dismiss}</button>
      </DialogContent>
    </Dialog>
  )
}
