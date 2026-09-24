import { create } from 'zustand'
import type { PresenceSummary } from './protocol'

type PresenceState = {
  /** People inside the exhibition right now, or null while unknown/unavailable. */
  count: number | null
  viewers: PresenceSummary['viewers']
  peers: PresenceSummary['peers']
  setSummary: (summary: PresenceSummary | null) => void
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  count: null,
  viewers: {},
  peers: [],
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
}))
