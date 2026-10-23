import { create } from 'zustand'

export const ARCADE = { x: 16.5, z: -4.25, width: 0.95, depth: 0.8 }
export const useArcadeStore = create<{ open: boolean; aiming: boolean; setOpen: (open: boolean) => void; setAiming: (aiming: boolean) => void }>((set) => ({
  open: false, aiming: false,
  setOpen: (open) => set({ open }),
  setAiming: (aiming) => set({ aiming }),
}))
