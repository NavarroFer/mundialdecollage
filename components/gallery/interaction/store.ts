import { create } from 'zustand'
import type { GalleryIntent, GalleryReturn } from '@/lib/gallery-return'

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
  /** What the visitor was doing when they left to sign in with Google (lib/gallery-return.ts). */
  pendingReturn: GalleryReturn | null
  /** Reopens that obra so the action can finish once the visitor is back. */
  resume: (pending: GalleryReturn) => void
  /** True once, for the component that finishes this obra's pending action. */
  consumeIntent: (slug: string, intent: GalleryIntent) => boolean
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
  pendingReturn: null,
  resume: (pending) => set({ pendingReturn: pending, openId: pending.slug }),
  consumeIntent: (slug, intent) => {
    const pending = get().pendingReturn
    if (pending?.slug !== slug || pending.intent !== intent) return false
    set({ pendingReturn: null })
    return true
  },
}))
