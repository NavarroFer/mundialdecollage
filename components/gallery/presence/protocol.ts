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

// Live avatars: every position goes to everyone, so messages grow with the
// square of the crowd. Past this many people inside, positions stop being
// sent or shown (the count and viewers keep working).
// With 8 moving and a few more watching, that's already ~2,000 deliveries a
// minute against the plan's monthly message quota (see GalleryPresence.tsx).
export const MAX_LIVE_VISITORS = 8
/** At most 2 positions a second while moving; avatars ease between them. */
export const POSE_MIN_INTERVAL_MS = 500
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
  /** The cast member (world/people/cast.ts) they chose to be seen as, if any. */
  avatar?: string
  /** Holding Control. */
  crouching?: boolean
  /**
   * Hops taken since they came in. A count instead of a flag, so a jump
   * still shows when its message was throttled or lost: the next one has it.
   */
  jumps?: number
}

export type SentPose = { x: number; z: number; h: number; crouching: boolean; jumps: number; t: number }

function angleBetween(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

export function shouldSendPose(last: SentPose | null, next: SentPose): boolean {
  if (!last) return true
  const elapsed = next.t - last.t
  if (elapsed >= POSE_HEARTBEAT_MS) return true
  if (elapsed < POSE_MIN_INTERVAL_MS) return false
  return Math.hypot(next.x - last.x, next.z - last.z) > MIN_MOVE
    || angleBetween(next.h, last.h) > MIN_TURN
    || next.crouching !== last.crouching
    || next.jumps !== last.jumps
}

const round = (value: number, digits: number) => Number(value.toFixed(digits))

// Rides on every position, so it costs no extra message; the receiver checks it against the cast.
const AVATAR_NAME = /^\w{1,40}$/

export function poseMessage({ key, seq, x, z, h, avatar, crouching, jumps }: Pose) {
  return {
    k: key, s: seq, x: round(x, 2), z: round(z, 2), h: round(h, 3),
    ...(avatar && { a: avatar }), ...(crouching && { c: 1 }), ...(jumps && { j: jumps }),
  }
}

export function parsePose(payload: unknown): Pose | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { k, s, x, z, h, a, c, j } = payload as Record<string, unknown>
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
    ...(typeof a === 'string' && AVATAR_NAME.test(a) && { avatar: a }),
    ...(c === 1 && { crouching: true }),
    ...(typeof j === 'number' && Number.isSafeInteger(j) && j > 0 && { jumps: j }),
  }
}

// Clothing tones rather than primaries, still distinct enough to tell markers apart.
const SHIRTS = ['#8fb3d9', '#b5553c', '#6b7c4b', '#34496e', '#7b2d3b', '#c99a3a', '#5f8f86', '#5e3b2a']

/** A stable look per visitor, so the same person doesn't change clothes. */
export function appearanceFor(key: string, looks: number): { look: number; shirt: string } {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return { look: hash % looks, shirt: SHIRTS[Math.floor(hash / looks) % SHIRTS.length] }
}
