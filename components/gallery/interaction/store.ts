import { create } from 'zustand'

type InteractionState = {
  /** Artwork id the player is currently close to and looking at, if any. */
  targetId: string | null
  /** Artwork id whose modal is open, if any. */
  openId: string | null
  setTarget: (id: string | null) => void
  open: (id: string) => void
  close: () => void
  /** Open the current target, or close whatever's open — shared by the E key and the mobile interact button. */
  toggle: () => void
}

export const useInteractionStore = create<InteractionState>((set, get) => ({
  targetId: null,
  openId: null,
  setTarget: (id) => {
    if (get().targetId !== id) set({ targetId: id })
  },
  open: (id) => set({ openId: id }),
  close: () => set({ openId: null }),
  toggle: () => {
    const { targetId, openId } = get()
    if (openId) {
      set({ openId: null })
      return
    }
    if (targetId) set({ openId: targetId })
  },
}))
