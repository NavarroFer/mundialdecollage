import { describe, expect, it } from 'vitest'
import type { NotificationRow } from './repository'
import { initialNotificationsState, notificationsReducer, type NotificationsState } from './state'

const row = (id: string, overrides: Partial<NotificationRow> = {}): NotificationRow => ({
  id,
  type: 'wall_approved',
  admin: false,
  data: {},
  read_at: null,
  updated_at: '2026-10-05T12:00:00Z',
  ...overrides,
})

function ready(items: NotificationRow[], unread: number): NotificationsState {
  return { ...initialNotificationsState(unread), status: 'ready', items }
}

describe('notificationsReducer', () => {
  it('keeps the list on screen while it reloads', () => {
    const state = notificationsReducer(ready([row('a')], 1), { type: 'loading', more: false })
    expect(state.status).toBe('loading')
    expect(state.items).toHaveLength(1)
  })

  it('appends the next page without repeating a notice that moved', () => {
    const state = notificationsReducer(ready([row('a'), row('b')], 0), {
      type: 'loaded',
      items: [row('b'), row('c')],
      nextCursor: null,
      more: true,
    })
    expect(state.items.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('marks one read and lowers the badge once', () => {
    let state = notificationsReducer(ready([row('a'), row('b')], 2), { type: 'markedRead', id: 'a', at: 'now' })
    expect(state.unread).toBe(1)
    expect(state.items[0].read_at).toBe('now')
    state = notificationsReducer(state, { type: 'markedRead', id: 'a', at: 'later' })
    expect(state.unread).toBe(1)
    expect(state.items[0].read_at).toBe('now')
  })

  it('marks only the admin ones read under the Admin filter', () => {
    const state = notificationsReducer(ready([row('a', { admin: true }), row('b')], 5), {
      type: 'markedAllRead',
      scope: 'admin',
      at: 'now',
    })
    expect(state.items.map((r) => r.read_at)).toEqual(['now', null])
    expect(state.unread).toBe(4)
  })

  it('clears the badge when marking everything read', () => {
    const state = notificationsReducer(ready([row('a')], 30), { type: 'markedAllRead', scope: 'all', at: 'now' })
    expect(state.unread).toBe(0)
  })
})
