import type { Locale } from '@/lib/i18n/locales'
import type { Messages } from '@/lib/i18n/messages/es'

// Every kind of notification the bell can show, one entry each (a registry
// of strategies): what its `data` looks like, its icon, and how it reads and
// where it leads. The database writes the rows (the triggers in
// supabase/migrations/2026100512*_notifications.sql); this turns them into
// text in the reader's language. A row whose type isn't here, or whose
// data doesn't match, is skipped rather than shown broken.
//
// Adding a kind: a trigger that writes it, an entry here and, for visitors,
// its texts in every dictionary (lib/i18n/messages, `notifications.types`).
// Admin notices are in Spanish only, like the rest of the panel.

export type NotificationIcon =
  | 'comment'
  | 'wall'
  | 'wallRejected'
  | 'activity'
  | 'exhibition'
  | 'referral'
  | 'pending'
  | 'alert'
  | 'image'
  | 'money'

export type RenderContext = {
  locale: Locale
  m: Messages['notifications']
  /** What an obra without a title is called. */
  untitled: string
  now: Date
}

export type RenderedNotification = { text: string; href: string | null; icon: NotificationIcon }

type RegisteredDefinition = {
  icon: NotificationIcon
  render: (data: unknown, context: RenderContext) => { text: string; href: string | null } | null
}

export const NOTIFICATION_TYPES = {} satisfies Record<string, RegisteredDefinition>

export type NotificationType = keyof typeof NOTIFICATION_TYPES

export function isNotificationType(value: string): value is NotificationType {
  return Object.hasOwn(NOTIFICATION_TYPES, value)
}

/** The row as the bell shows it, or null when it can't be shown. */
export function renderNotification(row: { type: string; data: unknown }, context: RenderContext): RenderedNotification | null {
  if (!isNotificationType(row.type)) return null
  const definition: RegisteredDefinition = NOTIFICATION_TYPES[row.type]
  const rendered = definition.render(row.data, context)
  return rendered && { ...rendered, icon: definition.icon }
}
