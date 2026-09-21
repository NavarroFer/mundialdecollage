import { create } from 'zustand'

type TouchInputState = {
  /** Joystick axes, each -1..1. moveZ positive = forward. */
  moveX: number
  moveZ: number
  setMove: (x: number, z: number) => void
  /** Raw look-drag pixels accumulated since the last frame consumed them. */
  lookDeltaX: number
  lookDeltaY: number
  addLookDelta: (dx: number, dy: number) => void
  consumeLookDelta: () => { x: number; y: number }
}

export const useTouchStore = create<TouchInputState>((set, get) => ({
  moveX: 0,
  moveZ: 0,
  setMove: (x, z) => set({ moveX: x, moveZ: z }),
  lookDeltaX: 0,
  lookDeltaY: 0,
  addLookDelta: (dx, dy) => set((state) => ({ lookDeltaX: state.lookDeltaX + dx, lookDeltaY: state.lookDeltaY + dy })),
  consumeLookDelta: () => {
    const { lookDeltaX, lookDeltaY } = get()
    if (lookDeltaX !== 0 || lookDeltaY !== 0) set({ lookDeltaX: 0, lookDeltaY: 0 })
    return { x: lookDeltaX, y: lookDeltaY }
  },
}))
