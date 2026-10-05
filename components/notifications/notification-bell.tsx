'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/client'
import { plural } from '@/lib/i18n/format'
import { cn } from '@/lib/utils'
import { NotificationPanel } from './notification-panel'
import { useNotifications } from './use-notifications'

/**
 * The header's bell: a badge with the unread count and, on click, the list
 * (full screen on phones, a panel under the header elsewhere). No Realtime —
 * the count comes with the page and is refreshed when the tab comes back
 * into view, which keeps it free (see the gallery's Realtime budget).
 */
export function NotificationBell({ initialUnread, isAdmin, className }: { initialUnread: number; isAdmin: boolean; className?: string }) {
  const { m, locale } = useI18n()
  const t = m.notifications
  const notifications = useNotifications(initialUnread)
  const { refreshUnread, load } = notifications
  const unread = notifications.state.unread
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onVisible = () => {
      // The header has a bell per layout; only the one on screen asks.
      if (document.visibilityState === 'visible' && buttonRef.current?.getClientRects().length) void refreshUnread()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshUnread])

  // Fresh list every time it opens, and again when a filter changes.
  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const label = unread > 0 ? `${t.title} (${plural(locale, unread, t.unreadCount)})` : t.title

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        className={cn(
          'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 text-ink transition-all duration-300 ease-out group-data-[scrolled=true]/header:h-10 group-data-[scrolled=true]/header:w-10 hover:-translate-y-0.5 hover:bg-ink hover:text-paper hover:shadow-md active:translate-y-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
          className,
        )}
      >
        <Bell className="h-4.5 w-4.5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-paper bg-collage-red px-1 text-[10px] leading-none font-bold text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <DialogContent
        showClose={false}
        aria-describedby={undefined}
        overlayClassName="bg-ink/30"
        className="inset-0 top-0 left-0 flex h-dvh w-full translate-x-0 translate-y-0 flex-col rounded-none border-0 sm:inset-auto sm:top-24 sm:right-4 sm:left-auto sm:h-auto sm:max-h-[min(40rem,calc(100dvh-6rem))] sm:w-[26rem] sm:rounded-2xl sm:border-2 sm:border-ink"
      >
        <NotificationPanel
          notifications={notifications}
          isAdmin={isAdmin}
          variant="popover"
          onNavigate={() => setOpen(false)}
          heading={<DialogTitle className="font-display text-2xl tracking-wide uppercase">{t.title}</DialogTitle>}
          actions={
            <DialogClose className="rounded-full p-2 text-ink transition-colors hover:bg-ink/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{t.close}</span>
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
