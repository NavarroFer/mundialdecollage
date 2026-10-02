import { create } from 'zustand'

type SouvenirState = {
  /** Renders the scene once more and copies it out (set by SouvenirCapture, inside the Canvas). */
  capture: (() => HTMLCanvasElement | null) | null
  /** True while the photo's preview is up, so the pause screen and the E key stay out of its way. */
  open: boolean
  setCapture: (capture: SouvenirState['capture']) => void
  setOpen: (open: boolean) => void
}

export const useSouvenirStore = create<SouvenirState>((set) => ({
  capture: null,
  open: false,
  setCapture: (capture) => set({ capture }),
  setOpen: (open) => set({ open }),
}))
