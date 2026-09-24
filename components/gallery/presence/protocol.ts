// What travels over the gallery's Realtime channel, and how incoming data is
// checked. Anyone with the public anon key can publish on the channel, so
// everything received is validated before it reaches the UI.

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
