'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { STAMP_LOOKS, STAMP_TONES } from '@/components/stamp-catalog'
import { useI18n } from '@/lib/i18n/client'
import { fmt } from '@/lib/i18n/format'
import { notificationRepository } from '@/lib/notifications/repository'
import {
  ALBUM_HREF, isStampKey, openStampShare, STAMP_CHECK_EVENT, STAMP_KEYS, STAMP_UNLOCKED_EVENT,
  type StampKey, type StampUnlocked,
} from '@/lib/stamps'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// Tells, on screen and at once, that a stamp was just earned — the bell has
// its own notice for it (the database writes both). Most stamps come from a
// trigger on a like, a saved obra, a post…, so nothing in the page knows
// when one lands: after an action that may earn one (requestStampCheck) this
// asks for the stamp notices newer than the last one shown. Never on its
// own for people without a session, and never for old ones: the first time
// only starts the clock.

const SEEN_KEY = 'mundial-stamps-toast-seen'
const SHOWN_MS = 9000

type Toast = { stamp: StampKey; count: number }

const readSeen = () => { try { return window.localStorage.getItem(SEEN_KEY) } catch { return null } }
const writeSeen = (value: string) => { try { window.localStorage.setItem(SEEN_KEY, value) } catch { /* private mode */ } }

export function StampToaster() {
  const { m } = useI18n()
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const checking = useRef(false)
  // Announced some other way already (the album opens by itself for a visit).
  const announced = useRef(new Set<string>())

  const check = useCallback(async () => {
    if (checking.current || !document.cookie.split('; ').some((part) => part.startsWith('sb-'))) return
    checking.current = true
    try {
      const since = readSeen()
      if (!since) { writeSeen(new Date().toISOString()); return }
      const found = await notificationRepository(createClient()).stampsSince(since)
      const last = found.at(-1)
      if (!last) return
      writeSeen(last.updatedAt)
      const fresh = found.filter((item) => isStampKey(item.stamp) && !announced.current.has(item.stamp))
      const latest = fresh.at(-1)
      if (!latest || !isStampKey(latest.stamp)) return
      window.clearTimeout(timer.current)
      setToast({ stamp: latest.stamp, count: latest.count })
      timer.current = window.setTimeout(() => setToast(null), SHOWN_MS)
    } catch {
      // The toast is a nicety; the bell has the notice.
    } finally {
      checking.current = false
    }
  }, [])

  useEffect(() => {
    // Once when a page opens (a stamp earned while away), and after actions.
    const first = window.setTimeout(() => void check(), 1500)
    const onUnlocked = (event: Event) => {
      const { stamp, awarded } = (event as CustomEvent<StampUnlocked>).detail
      if (awarded) announced.current.add(stamp)
    }
    const onCheck = () => window.setTimeout(() => void check(), 900)
    window.addEventListener(STAMP_CHECK_EVENT, onCheck)
    window.addEventListener(STAMP_UNLOCKED_EVENT, onUnlocked)
    return () => {
      window.clearTimeout(first)
      window.clearTimeout(timer.current)
      window.removeEventListener(STAMP_CHECK_EVENT, onCheck)
      window.removeEventListener(STAMP_UNLOCKED_EVENT, onUnlocked)
    }
  }, [check])

  if (!toast) return null
  const look = STAMP_LOOKS[toast.stamp]
  const tone = STAMP_TONES[look.tone]
  const { Icon } = look
  const t = m.stamps

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[2147483646] flex justify-center px-4 lg:bottom-8">
      <div className="pointer-events-auto relative flex w-full max-w-sm items-center gap-3 border-2 border-dashed border-ink bg-paper p-3 pr-10 shadow-[5px_5px_0_var(--color-ink)] animate-in fade-in-0 slide-in-from-bottom-3 duration-300 motion-reduce:animate-none">
        <span className={cn('flex size-14 shrink-0 items-center justify-center border-2 border-dashed border-current', tone.className, look.tilt)} aria-hidden="true">
          <Icon className="size-7" strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.16em] text-collage-red uppercase">{t.unlocked}</p>
          <p className="font-display truncate text-xl leading-tight uppercase">{t[toast.stamp].title}</p>
          <p className="text-xs font-semibold text-muted-foreground">{fmt(t.toastProgress, { count: toast.count, total: STAMP_KEYS.length })}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={() => { openStampShare({ stamp: toast.stamp, count: toast.count }); setToast(null) }}
              className="min-h-8 text-sm font-bold underline underline-offset-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t.share}
            </button>
            <Link href={ALBUM_HREF} onClick={() => setToast(null)} className="inline-flex min-h-8 items-center text-sm font-semibold underline underline-offset-2">{t.seeAlbum}</Link>
          </div>
        </div>
        <button type="button" onClick={() => setToast(null)} aria-label={t.dismiss} className="absolute top-1 right-1 rounded-full p-2 hover:bg-ink/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
