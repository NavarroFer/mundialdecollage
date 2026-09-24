// What travels over the gallery's Realtime channel, and how incoming data is
// checked. Anyone with the public anon key can publish on the channel, so
// everything received is validated before it reaches the UI.

import { GALLERY_BOUNDS } from '../world/roomsData'

type PresenceMeta = { viewing?: unknown }

export type PresenceSummary = {
  /** Everyone inside, the viewer included once they've entered. */
  count: number
  /** Other visitors with each artwork's modal open, keyed by artwork id. */
  viewers: Record<string, number>
  /** Other visitors' presence keys, sorted so equal sets compare equal. */
  peers: string[]
}

export function summarizePresence(
  state: Record<string, ReadonlyArray<PresenceMeta>>,
  ownKey: string,
  artworkIds: ReadonlySet<string>,
): PresenceSummary {
  const keys = Object.keys(state)
  const viewers: Record<string, number> = {}
  const peers: string[] = []
  for (const key of keys) {
    if (key === ownKey) continue
    peers.push(key)
    const viewing = state[key][0]?.viewing
    if (typeof viewing === 'string' && artworkIds.has(viewing)) viewers[viewing] = (viewers[viewing] ?? 0) + 1
  }
  return { count: keys.length, viewers, peers: peers.sort() }
}

// A fixed set, so reactions never need moderation.
export const REACTIONS = [
  { emoji: '❤️', label: 'Me encanta' },
  { emoji: '👏', label: 'Aplausos' },
  { emoji: '🔥', label: 'Fuego' },
  { emoji: '✨', label: 'Brillante' },
] as const

export type ReactionEmoji = (typeof REACTIONS)[number]['emoji']

const reactionEmojis = new Set<string>(REACTIONS.map((reaction) => reaction.emoji))

export function parseReaction(payload: unknown, artworkIds: ReadonlySet<string>): { artworkId: string; emoji: ReactionEmoji } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { artworkId, emoji } = payload as Record<string, unknown>
  if (typeof artworkId !== 'string' || !artworkIds.has(artworkId)) return null
  if (typeof emoji !== 'string' || !reactionEmojis.has(emoji)) return null
  return { artworkId, emoji: emoji as ReactionEmoji }
}

// Live avatars: every position goes to everyone, so messages grow with the
// square of the crowd. Past this many people inside, positions stop being
// sent or shown (the count, viewers and reactions keep working).
export const MAX_LIVE_VISITORS = 12
/** At most ~3 positions a second while moving. */
export const POSE_MIN_INTERVAL_MS = 330
/** A standing visitor still re-sends now and then, in case one got lost. */
export const POSE_HEARTBEAT_MS = 10_000
const MIN_MOVE = 0.05
const MIN_TURN = 0.08

export type Pose = {
  key: string
  /** Per-sender counter: broadcasts can arrive out of order. */
  seq: number
  x: number
  z: number
  /** Look direction in radians, 0 = facing -Z (same as the minimap). */
  h: number
}

export type SentPose = { x: number; z: number; h: number; t: number }

function angleBetween(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

export function shouldSendPose(last: SentPose | null, next: SentPose): boolean {
  if (!last) return true
  const elapsed = next.t - last.t
  if (elapsed >= POSE_HEARTBEAT_MS) return true
  if (elapsed < POSE_MIN_INTERVAL_MS) return false
  return Math.hypot(next.x - last.x, next.z - last.z) > MIN_MOVE || angleBetween(next.h, last.h) > MIN_TURN
}

const round = (value: number, digits: number) => Number(value.toFixed(digits))

export function poseMessage({ key, seq, x, z, h }: Pose) {
  return { k: key, s: seq, x: round(x, 2), z: round(z, 2), h: round(h, 3) }
}

export function parsePose(payload: unknown): Pose | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { k, s, x, z, h } = payload as Record<string, unknown>
  if (typeof k !== 'string' || k.length === 0 || k.length > 64) return null
  if (typeof s !== 'number' || !Number.isSafeInteger(s) || s < 0) return null
  if (![x, z, h].every((value) => typeof value === 'number' && Number.isFinite(value))) return null
  const [minX, minZ, maxX, maxZ] = GALLERY_BOUNDS
  return {
    key: k,
    seq: s,
    x: Math.min(maxX, Math.max(minX, x as number)),
    z: Math.min(maxZ, Math.max(minZ, z as number)),
    h: h as number,
  }
}

const SHIRTS = ['#d45b45', '#4c76b8', '#d6a62e', '#6f8d63', '#8d63a8', '#2f8f8a', '#c2577f', '#e07b39']

/** A stable look per visitor, so the same person doesn't change clothes. */
export function appearanceFor(key: string, looks: number): { look: number; shirt: string } {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return { look: hash % looks, shirt: SHIRTS[Math.floor(hash / looks) % SHIRTS.length] }
}
