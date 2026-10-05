'use client'

import { useEffect } from 'react'
import { NotificationPanel } from './notification-panel'
import { useNotifications } from './use-notifications'

/** /notificaciones: the same list as the bell, with every page of it. */
export function NotificationsPageList({ initialUnread, isAdmin, heading }: { initialUnread: number; isAdmin: boolean; heading: string }) {
  const notifications = useNotifications(initialUnread)
  const { load } = notifications

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-sm">
      <NotificationPanel
        notifications={notifications}
        isAdmin={isAdmin}
        variant="page"
        heading={<h1 className="font-display text-3xl tracking-wide uppercase sm:text-4xl">{heading}</h1>}
      />
    </div>
  )
}
