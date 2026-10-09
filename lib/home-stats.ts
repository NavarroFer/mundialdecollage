// The home's live counters: the totals the database sends on a listen-only
// Realtime topic whenever they change
// (supabase/migrations/20261009010000_home_stats_broadcast.sql), also what
// public.home_stats() returns to a tab catching up after a reconnect.
// Delivered by Supabase straight to the browser (components/use-live-home-stats.ts).
export const HOME_STATS_TOPIC = 'home-stats'
export const HOME_STATS_EVENT = 'stats'

export type HomeStats = {
  // Published obras and their countries: the hero's «Ya participan…».
  artworks: number
  countries: number
  // Every obra received: the edition banner's.
  received: number
}

export function parseHomeStats(value: unknown): HomeStats | null {
  if (!value || typeof value !== 'object') return null
  const { artworks, countries, received } = value as Record<string, unknown>
  const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0
  if (!isCount(artworks) || !isCount(countries) || !isCount(received)) return null
  return { artworks, countries, received }
}

// One connection for every counter on the page, open while at least one of
// them is watching (on screen, in a visible tab). Each open connection takes
// one of the Supabase plan's concurrent slots, shared with the 3D gallery, so
// it's let go `idleMs` after the last counter stops watching; the delay keeps
// a quick scroll past, or a moment in another tab, from reconnecting.
export function createConnectionKeeper(open: () => () => void, idleMs: number) {
  let watchers = 0
  let close: (() => void) | null = null
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  return {
    watch() {
      watchers++
      clearTimeout(idleTimer)
      close ??= open()
    },
    unwatch() {
      watchers = Math.max(0, watchers - 1)
      if (watchers > 0) return
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        close?.()
        close = null
      }, idleMs)
    },
  }
}
