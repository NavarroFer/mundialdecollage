import { create } from 'zustand'

type PlayerTrackerState = {
  x: number
  z: number
  /** Radians, 0 = facing -Z ("up" on the minimap). */
  heading: number
  setPose: (x: number, z: number, heading: number) => void
}

export const usePlayerTrackerStore = create<PlayerTrackerState>((set) => ({
  x: 0,
  z: 3,
  heading: 0,
  setPose: (x, z, heading) => set({ x, z, heading }),
}))
