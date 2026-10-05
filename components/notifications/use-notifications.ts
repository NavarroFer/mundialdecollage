'use client'

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  notificationRepository,
  type NotificationCursor,
  type NotificationFilter,
} from '@/lib/notifications/repository'
import { initialNotificationsState, notificationsReducer } from '@/lib/notifications/state'

// Tells the other bells on the page (the header has one per layout, plus the
// /notificaciones list) that something was marked read, so their badges
// catch up.
const CHANGED_EVENT = 'mundial:notifications-changed'

/** The bell's data and actions; the components only draw them. */
export function useNotifications(initialUnread: number) {
  const repository = useMemo(() => notificationRepository(createClient()), [])
  const [state, dispatch] = useReducer(notificationsReducer, initialUnread, initialNotificationsState)
  const [filter, setFilter] = useState<NotificationFilter>({ unreadOnly: false, scope: 'all' })
  const instance = useId()
  // Only the latest request may fill the list (switching tabs quickly).
  const latestRequest = useRef(0)

  const announce = useCallback(() => {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: instance }))
  }, [instance])

  const refreshUnread = useCallback(async () => {
    try {
      dispatch({ type: 'counted', unread: await repository.countUnread() })
    } catch (error) {
      // The badge keeps its last count.
      console.error('notifications: unread count failed', error)
    }
  }, [repository])

  /** First page for the current filter, or the next one after `cursor`. */
  const load = useCallback(
    async (cursor: NotificationCursor | null = null) => {
      const request = ++latestRequest.current
      const more = cursor !== null
      dispatch({ type: 'loading', more })
      try {
        const [page, unread] = await Promise.all([
          repository.list(filter, cursor),
          more ? null : repository.countUnread(),
        ])
        if (request !== latestRequest.current) return
        dispatch({ type: 'loaded', items: page.items, nextCursor: page.nextCursor, more })
        if (unread !== null) dispatch({ type: 'counted', unread })
      } catch (error) {
        if (request !== latestRequest.current) return
        console.error('notifications: list failed', error)
        dispatch({ type: 'failed' })
      }
    },
    [repository, filter],
  )

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic: the dot goes away at once; a failure recounts.
      dispatch({ type: 'markedRead', id, at: new Date().toISOString() })
      try {
        await repository.markRead(id)
        announce()
      } catch (error) {
        console.error('notifications: mark read failed', error)
        await refreshUnread()
      }
    },
    [repository, announce, refreshUnread],
  )

  const markAllRead = useCallback(async () => {
    const { scope } = filter
    dispatch({ type: 'markedAllRead', scope, at: new Date().toISOString() })
    try {
      await repository.markAllRead(scope)
      announce()
      if (scope !== 'all') await refreshUnread()
    } catch (error) {
      console.error('notifications: mark all read failed', error)
      await load()
    }
  }, [repository, filter, announce, refreshUnread, load])

  useEffect(() => {
    const onChanged = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== instance) void refreshUnread()
    }
    window.addEventListener(CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(CHANGED_EVENT, onChanged)
  }, [instance, refreshUnread])

  return { state, filter, setFilter, load, refreshUnread, markRead, markAllRead }
}

export type NotificationsController = ReturnType<typeof useNotifications>
