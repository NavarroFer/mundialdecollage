import { create } from 'zustand'

type PlayerTrackerState = {
  x: number
  z: number
  /** Radians, 0 = facing -Z ("up" on the minimap). */
  heading: number
  /** Holding Control, as other visitors see it. */
  crouching: boolean
  /** Hops taken this visit: other visitors play one each time it grows. */
  jumps: number
  setPose: (x: number, z: number, heading: number) => void
  setCrouching: (crouching: boolean) => void
  jumped: () => void
}

export const usePlayerTrackerStore = create<PlayerTrackerState>((set) => ({
  x: 0,
  z: 3,
  heading: 0,
  crouching: false,
  jumps: 0,
  setPose: (x, z, heading) => set({ x, z, heading }),
  setCrouching: (crouching) => set({ crouching }),
  jumped: () => set((state) => ({ jumps: state.jumps + 1 })),
}))
