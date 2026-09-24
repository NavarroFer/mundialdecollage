import { create } from 'zustand'
import type { PresenceSummary, ReactionEmoji } from './protocol'

export type LiveReaction = {
  id: number
  artworkId: string
  emoji: ReactionEmoji
  /** -0.5..0.5 — where across the obra it floats up, so bursts spread out. */
  offset: number
}

/** How long a reaction stays on screen, in ms. */
export const REACTION_LIFETIME_MS = 2600
// Caps what a flood of messages (or a busy room) can put on screen at once.
const MAX_REACTIONS = 30

type PresenceState = {
  /** People inside the exhibition right now, or null while unknown/unavailable. */
  count: number | null
  viewers: PresenceSummary['viewers']
  peers: PresenceSummary['peers']
  reactions: LiveReaction[]
  /** Sends a reaction to everyone inside; null while not connected. */
  react: ((artworkId: string, emoji: ReactionEmoji) => void) | null
  setSummary: (summary: PresenceSummary | null) => void
  addReaction: (artworkId: string, emoji: ReactionEmoji) => void
}

let nextReactionId = 0

export const usePresenceStore = create<PresenceState>((set, get) => ({
  count: null,
  viewers: {},
  peers: [],
  reactions: [],
  react: null,
  setSummary: (summary) => {
    if (!summary) {
      set({ count: null, viewers: {}, peers: [] })
      return
    }
    // Keep the old array when nobody joined or left, so avatar lists don't
    // re-render on every presence sync.
    const peers = summary.peers.join() === get().peers.join() ? get().peers : summary.peers
    set({ count: summary.count, viewers: summary.viewers, peers })
  },
  addReaction: (artworkId, emoji) => {
    if (get().reactions.length >= MAX_REACTIONS) return
    const reaction = { id: nextReactionId++, artworkId, emoji, offset: Math.random() - 0.5 }
    set({ reactions: [...get().reactions, reaction] })
    setTimeout(() => set({ reactions: get().reactions.filter((item) => item.id !== reaction.id) }), REACTION_LIFETIME_MS)
  },
}))
