import { create } from 'zustand'

type PresenceState = {
  /** People inside the exhibition right now, or null while unknown/unavailable. */
  count: number | null
  setCount: (count: number | null) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  count: null,
  setCount: (count) => set({ count }),
}))
