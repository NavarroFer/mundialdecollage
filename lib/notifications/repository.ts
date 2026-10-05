import type { SupabaseClient } from '@supabase/supabase-js'

// Every read and write of the bell, in one place. Works with either Supabase
// client: the server one (the header's unread count) or the browser one (the
// list, marking read). RLS keeps both to the signed-in person's own rows —
// that's the security boundary, not the filters here — and only lets them
// change read_at (supabase/migrations/20261005120000_notifications.sql).

export type NotificationRow = {
  id: string
  type: string
  admin: boolean
  data: unknown
  read_at: string | null
  updated_at: string
}

/** Which notices: everything, only the admin ones, or only one's own. */
export type NotificationScope = 'all' | 'admin' | 'mine'

export type NotificationFilter = { unreadOnly: boolean; scope: NotificationScope }

/** Where the next page starts: right after this row, newest first. */
export type NotificationCursor = { updatedAt: string; id: string }

export type NotificationPage = { items: NotificationRow[]; nextCursor: NotificationCursor | null }

export const NOTIFICATIONS_PAGE_SIZE = 20

const COLUMNS = 'id, type, admin, data, read_at, updated_at'

// PostgREST's or=() needs values with reserved characters (a timestamp's
// dots and colons) in double quotes.
export function afterCursorFilter(cursor: NotificationCursor): string {
  const at = `"${cursor.updatedAt}"`
  return `updated_at.lt.${at},and(updated_at.eq.${at},id.lt.${cursor.id})`
}

/** The `admin` value a scope filters on, or null when it takes both. */
export function adminFlag(scope: NotificationScope): boolean | null {
  return scope === 'all' ? null : scope === 'admin'
}

export function notificationRepository(db: SupabaseClient) {
  return {
    async countUnread(): Promise<number> {
      const { count, error } = await db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
      if (error) throw new Error(error.message)
      return count ?? 0
    },

    async list(filter: NotificationFilter, cursor: NotificationCursor | null = null, limit = NOTIFICATIONS_PAGE_SIZE): Promise<NotificationPage> {
      let query = db.from('notifications').select(COLUMNS)
      if (filter.unreadOnly) query = query.is('read_at', null)
      const admin = adminFlag(filter.scope)
      if (admin !== null) query = query.eq('admin', admin)
      if (cursor) query = query.or(afterCursorFilter(cursor))
      // One extra row says whether there's another page.
      const { data, error } = await query
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as NotificationRow[]
      const items = rows.slice(0, limit)
      const last = items.at(-1)
      return { items, nextCursor: rows.length > limit && last ? { updatedAt: last.updated_at, id: last.id } : null }
    },

    async markRead(id: string): Promise<void> {
      const { error } = await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
      if (error) throw new Error(error.message)
    },

    async markAllRead(scope: NotificationScope): Promise<void> {
      let query = db.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
      const admin = adminFlag(scope)
      if (admin !== null) query = query.eq('admin', admin)
      const { error } = await query
      if (error) throw new Error(error.message)
    },
  }
}

export type NotificationRepository = ReturnType<typeof notificationRepository>
