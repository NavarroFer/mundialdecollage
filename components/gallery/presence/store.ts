import { create } from 'zustand'
import type { Pose, PresenceSummary } from './protocol'

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

// Other visitors' latest positions. Read every frame by the avatars, so it
// lives outside React state — updating it re-renders nothing.
export const peerPoses = new Map<string, Pose & { receivedAt: number }>()
// A pose can arrive before the presence join it belongs to; keep it that long.
const ORPHAN_POSE_MS = 5000

/** Stores a pose unless a newer one from the same visitor already arrived. */
export function recordPeerPose(pose: Pose, now: number): boolean {
  const known = peerPoses.get(pose.key)
  if (known && known.seq >= pose.seq) return false
  peerPoses.set(pose.key, { ...pose, receivedAt: now })
  return true
}

export function prunePeerPoses(present: ReadonlySet<string>, now: number) {
  for (const [key, pose] of peerPoses) {
    if (!present.has(key) && now - pose.receivedAt > ORPHAN_POSE_MS) peerPoses.delete(key)
  }
}
