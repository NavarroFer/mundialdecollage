import { create } from 'zustand'

type TapHintState = {
  /** The first-visit "tap an obra" hint is up (TouchControls) and wants an obra to point at. */
  active: boolean
  /** Where that obra's center is, in pixels from the canvas's top left; null while none is in clear view. */
  spot: { x: number; y: number } | null
}

export const useTapHintStore = create<TapHintState>(() => ({ active: false, spot: null }))
