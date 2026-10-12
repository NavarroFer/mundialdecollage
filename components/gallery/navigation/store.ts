import { create } from 'zustand'
import type { Point } from './path'

export type WalkStatus = 'idle' | 'walking' | 'arrived' | 'blocked'

type NavigationState = {
  /** A click or tap on the scene, in client pixels, waiting for PointNavigation to aim it. */
  request: { x: number; y: number } | null
  /** Waypoints still to walk, next one first. */
  path: Point[]
  /** The obra that opens on arrival, when the click was on one. */
  artworkId: string | null
  status: WalkStatus
  requestPoint: (x: number, y: number) => void
  start: (path: Point[], artworkId?: string) => void
  /** Stops walking; `blocked` tells the visitor that spot can't be reached. */
  cancel: (blocked?: boolean) => void
  /** The player reached the next waypoint. */
  advance: () => void
  /** The arrived / blocked notice has been read. */
  settle: () => void
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  request: null,
  path: [],
  artworkId: null,
  status: 'idle',
  requestPoint: (x, y) => set({ request: { x, y } }),
  start: (path, artworkId) => set({ path, artworkId: artworkId ?? null, status: 'walking', request: null }),
  cancel: (blocked = false) => {
    if (!blocked && get().status === 'idle' && !get().request) return
    set({ request: null, path: [], artworkId: null, status: blocked ? 'blocked' : 'idle' })
  },
  advance: () => {
    const path = get().path.slice(1)
    set(path.length ? { path } : { path, artworkId: null, status: 'arrived' })
  },
  settle: () => {
    if (get().status !== 'walking') set({ status: 'idle' })
  },
}))
