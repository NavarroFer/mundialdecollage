import type { NotificationCursor, NotificationRow, NotificationScope } from './repository'

// The bell's list as a reducer: every change is one of these actions, so the
// component only says what happened and this decides what it means.

export type NotificationsState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: NotificationRow[]
  nextCursor: NotificationCursor | null
  loadingMore: boolean
  unread: number
}

export type NotificationsAction =
  | { type: 'loading'; more: boolean }
  | { type: 'loaded'; items: NotificationRow[]; nextCursor: NotificationCursor | null; more: boolean }
  | { type: 'failed' }
  | { type: 'counted'; unread: number }
  | { type: 'markedRead'; id: string; at: string }
  | { type: 'markedAllRead'; scope: NotificationScope; at: string }

export function initialNotificationsState(unread: number): NotificationsState {
  return { status: 'idle', items: [], nextCursor: null, loadingMore: false, unread }
}

const inScope = (row: NotificationRow, scope: NotificationScope) => scope === 'all' || row.admin === (scope === 'admin')

export function notificationsReducer(state: NotificationsState, action: NotificationsAction): NotificationsState {
  switch (action.type) {
    case 'loading':
      // Keeps what's on screen while it reloads, so the list doesn't flash.
      return action.more ? { ...state, loadingMore: true } : { ...state, status: 'loading' }
    case 'loaded': {
      if (!action.more) return { ...state, status: 'ready', items: action.items, nextCursor: action.nextCursor, loadingMore: false }
      // A grouped notice that changed between pages can come twice.
      const seen = new Set(state.items.map((row) => row.id))
      const items = [...state.items, ...action.items.filter((row) => !seen.has(row.id))]
      return { ...state, status: 'ready', items, nextCursor: action.nextCursor, loadingMore: false }
    }
    case 'failed':
      return { ...state, status: 'error', loadingMore: false }
    case 'counted':
      return { ...state, unread: Math.max(0, action.unread) }
    case 'markedRead': {
      const target = state.items.find((row) => row.id === action.id)
      if (!target || target.read_at) return state
      return {
        ...state,
        items: state.items.map((row) => (row.id === action.id ? { ...row, read_at: action.at } : row)),
        unread: Math.max(0, state.unread - 1),
      }
    }
    case 'markedAllRead': {
      const affected = state.items.filter((row) => !row.read_at && inScope(row, action.scope)).length
      return {
        ...state,
        items: state.items.map((row) => (!row.read_at && inScope(row, action.scope) ? { ...row, read_at: action.at } : row)),
        // Everything is read only when marking all of them; otherwise the
        // caller recounts (some unread ones may not be loaded).
        unread: action.scope === 'all' ? 0 : Math.max(0, state.unread - affected),
      }
    }
  }
}
