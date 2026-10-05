'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { renderNotification, type RenderContext } from '@/lib/notifications/registry'
import type { NotificationRow, NotificationScope } from '@/lib/notifications/repository'
import { relativeTime } from '@/lib/notifications/time'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { NotificationIcon } from './notification-icon'
import type { NotificationsController } from './use-notifications'

type Props = {
  notifications: NotificationsController
  isAdmin: boolean
  /** The title, as the container needs it (a dialog title, a page heading…). */
  heading: ReactNode
  /** Pinned to the top right of the header (the dialog's close button). */
  actions?: ReactNode
  /** The dialog links to the full page; the page loads more in place. */
  variant: 'popover' | 'page'
  /** Called when an item takes the reader somewhere (closes the dialog). */
  onNavigate?: () => void
}

/** The list with its filters, shared by the bell's dialog and /notificaciones. */
export function NotificationPanel({ notifications, isAdmin, heading, actions, variant, onNavigate }: Props) {
  const { m, locale } = useI18n()
  const t = m.notifications
  const { state, filter, setFilter } = notifications
  const context: RenderContext = { locale, m: t, untitled: m.common.untitled, now: new Date() }

  const scopes: [NotificationScope, string][] = [
    ['all', t.scopeAll],
    ['admin', t.scopeAdmin],
    ['mine', t.scopeMine],
  ]
  const visibleUnread = state.items.some((row) => !row.read_at)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-2 border-b-2 border-ink/10 px-5 py-4">
        {/* Wraps under the title when the language's label is long; the close button stays put. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {heading}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void notifications.markAllRead()}
            disabled={state.unread === 0 && !visibleUnread}
          >
            {t.markAllRead}
          </Button>
        </div>
        {actions}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <Segmented
          label={t.filterLabel}
          options={[
            [false, t.all],
            [true, `${t.unread}${state.unread > 0 ? ` (${state.unread > 99 ? '99+' : state.unread})` : ''}`],
          ]}
          value={filter.unreadOnly}
          onChange={(unreadOnly) => setFilter((current) => ({ ...current, unreadOnly }))}
        />
        {isAdmin && (
          <Segmented
            label={t.scopeLabel}
            options={scopes}
            value={filter.scope}
            onChange={(scope) => setFilter((current) => ({ ...current, scope }))}
          />
        )}
      </div>

      <div className={cn('min-h-0 flex-1', variant === 'popover' && 'overflow-y-auto overscroll-contain')} aria-busy={state.status === 'loading'}>
        {state.status === 'error' && !state.items.length ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">{t.error}</p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void notifications.load()}>
              {t.retry}
            </Button>
          </div>
        ) : (state.status === 'idle' || state.status === 'loading') && !state.items.length ? (
          <ul className="space-y-1 px-3 pb-3" aria-label={t.loading}>
            {[0, 1, 2].map((key) => (
              <li key={key} className="flex gap-3 rounded-xl px-2 py-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : !state.items.length ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">{filter.unreadOnly ? t.emptyUnread : t.emptyAll}</p>
        ) : (
          <ul className="space-y-1 px-3 pb-3">
            {state.items.map((row) => (
              <NotificationItem
                key={row.id}
                row={row}
                context={context}
                unreadLabel={t.unreadDot}
                onOpen={() => {
                  if (!row.read_at) void notifications.markRead(row.id)
                }}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}

        {variant === 'page' && state.nextCursor && (
          <div className="px-5 pb-6 text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={state.loadingMore}
              onClick={() => void notifications.load(state.nextCursor)}
            >
              {state.loadingMore ? t.loading : t.loadMore}
            </Button>
          </div>
        )}
      </div>

      {variant === 'popover' && (
        <div className="border-t-2 border-ink/10 px-5 py-3 text-center">
          <Link href="/notificaciones" onClick={onNavigate} className="text-sm font-semibold text-collage-blue hover:underline">
            {t.seeAll}
          </Link>
        </div>
      )}
    </div>
  )
}

function NotificationItem({
  row,
  context,
  unreadLabel,
  onOpen,
  onNavigate,
}: {
  row: NotificationRow
  context: RenderContext
  unreadLabel: string
  onOpen: () => void
  onNavigate?: () => void
}) {
  const rendered = renderNotification(row, context)
  if (!rendered) return null
  const unread = !row.read_at

  const body = (
    <>
      <NotificationIcon name={rendered.icon} />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm leading-snug text-ink', unread && 'font-semibold')}>{rendered.text}</span>
        <time dateTime={row.updated_at} className="mt-1 block text-xs text-muted-foreground">
          {relativeTime(context.locale, row.updated_at, context.now)}
        </time>
      </span>
      {unread && (
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-collage-red">
          <span className="sr-only">{unreadLabel}</span>
        </span>
      )}
    </>
  )
  const className = cn(
    'flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-ink/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
    unread && 'bg-collage-yellow/10',
  )

  return (
    <li>
      {rendered.href ? (
        <Link
          href={rendered.href}
          className={className}
          onClick={() => {
            onOpen()
            onNavigate?.()
          }}
        >
          {body}
        </Link>
      ) : (
        <button type="button" className={className} onClick={onOpen}>
          {body}
        </button>
      )}
    </li>
  )
}

function Segmented<Value extends string | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: [Value, string][]
  value: Value
  onChange: (value: Value) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-ink/[0.06] p-1">
      {options.map(([option, text]) => (
        <button
          key={String(option)}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
            option === value ? 'bg-paper text-ink shadow-sm' : 'text-ink/60 hover:text-ink',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
