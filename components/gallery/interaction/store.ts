import { create } from 'zustand'

type InteractionState = {
  /** Artwork id the player is currently close to and looking at, if any. */
  targetId: string | null
  /** Artwork id whose modal is open, if any. */
  openId: string | null
  setTarget: (id: string | null) => void
  open: (id: string) => void
  close: () => void
}

export const useInteractionStore = create<InteractionState>((set, get) => ({
  targetId: null,
  openId: null,
  setTarget: (id) => {
    if (get().targetId !== id) set({ targetId: id })
  },
  open: (id) => set({ openId: id }),
  close: () => set({ openId: null }),
}))
