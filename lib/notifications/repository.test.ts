import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { afterCursorFilter, notificationRepository, type NotificationRow } from './repository'

// A stand-in for supabase-js's query builder: records each call and resolves
// to whatever the test hands it.
function fakeClient(result: { data?: unknown; count?: number; error?: { message: string } | null }) {
  const calls: [string, ...unknown[]][] = []
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'update', 'eq', 'is', 'or', 'order', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return builder
    }
  }
  builder.then = (resolve: (value: unknown) => void) => resolve({ data: null, count: null, error: null, ...result })
  const client = { from: (table: string) => (calls.push(['from', table]), builder) }
  return { client: client as unknown as SupabaseClient, calls }
}

const row = (id: string, updatedAt: string): NotificationRow => ({ id, type: 'wall_approved', admin: false, data: {}, read_at: null, updated_at: updatedAt })

describe('notificationRepository', () => {
  it('quotes the cursor timestamp for PostgREST', () => {
    expect(afterCursorFilter({ updatedAt: '2026-10-05T12:00:00.123+00:00', id: 'abc' })).toBe(
      'updated_at.lt."2026-10-05T12:00:00.123+00:00",and(updated_at.eq."2026-10-05T12:00:00.123+00:00",id.lt.abc)',
    )
  })

  it('asks for one row more than a page to know whether there is another', async () => {
    const rows = [row('c', '2026-10-05T03:00:00Z'), row('b', '2026-10-05T02:00:00Z'), row('a', '2026-10-05T01:00:00Z')]
    const { client, calls } = fakeClient({ data: rows })
    const page = await notificationRepository(client).list({ unreadOnly: true, scope: 'admin' }, null, 2)

    expect(page.items.map((r) => r.id)).toEqual(['c', 'b'])
    expect(page.nextCursor).toEqual({ updatedAt: '2026-10-05T02:00:00Z', id: 'b' })
    expect(calls).toContainEqual(['is', 'read_at', null])
    expect(calls).toContainEqual(['eq', 'admin', true])
    expect(calls).toContainEqual(['limit', 3])
  })

  it('says there is no next page when the extra row is missing', async () => {
    const { client, calls } = fakeClient({ data: [row('a', '2026-10-05T01:00:00Z')] })
    const page = await notificationRepository(client).list({ unreadOnly: false, scope: 'all' }, { updatedAt: 'x', id: 'y' }, 2)
    expect(page.nextCursor).toBeNull()
    expect(calls.some(([method]) => method === 'eq')).toBe(false)
    expect(calls.some(([method]) => method === 'or')).toBe(true)
  })

  it('marks all read only within the chosen scope, and only unread ones', async () => {
    const { client, calls } = fakeClient({})
    await notificationRepository(client).markAllRead('mine')
    expect(calls).toContainEqual(['is', 'read_at', null])
    expect(calls).toContainEqual(['eq', 'admin', false])
  })

  it('surfaces database errors', async () => {
    const { client } = fakeClient({ error: { message: 'boom' } })
    await expect(notificationRepository(client).countUnread()).rejects.toThrow('boom')
  })
})
