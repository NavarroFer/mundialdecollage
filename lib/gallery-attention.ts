export const ATTENTION_MIN_MS = 2000
export const ATTENTION_IDLE_MS = 60_000
export const ATTENTION_MAX_MS = 4 * 60 * 60 * 1000
export const ATTENTION_BATCH_MAX = 40
export type AttentionMode = 'view' | 'details'
export type AttentionRow = { slug: string; mode: AttentionMode; milliseconds: number; episodes: number }
export type AttentionBatch = { accountId: string; sessionId: string; rows: AttentionRow[] }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseAttentionBatch(value: unknown): AttentionBatch | null {
  if (!value || typeof value !== 'object') return null
  const { sessionId, accountId, rows } = value as AttentionBatch
  if (typeof accountId !== 'string' || !uuid.test(accountId) || typeof sessionId !== 'string' || !uuid.test(sessionId) || !Array.isArray(rows) || !rows.length || rows.length > ATTENTION_BATCH_MAX) return null
  const keys = new Set<string>()
  let total = 0
  for (const row of rows) {
    if (!row || typeof row.slug !== 'string' || !row.slug.length || row.slug.length > 300 || !['view', 'details'].includes(row.mode)) return null
    if (!Number.isSafeInteger(row.milliseconds) || row.milliseconds < ATTENTION_MIN_MS || row.milliseconds > ATTENTION_MAX_MS) return null
    if (!Number.isSafeInteger(row.episodes) || row.episodes < 1 || row.episodes > Math.floor(row.milliseconds / ATTENTION_MIN_MS)) return null
    const key = `${row.mode}:${row.slug}`
    if (keys.has(key)) return null
    keys.add(key)
    total += row.milliseconds
  }
  return total <= ATTENTION_MAX_MS ? { sessionId, accountId, rows: rows.map(({ slug, mode, milliseconds, episodes }) => ({ slug, mode, milliseconds, episodes })) } : null
}

/** Cumulative counters make duplicate/out-of-order network deliveries harmless. */
export function createAttentionAccumulator() {
  const rows = new Map<string, AttentionRow>()
  let lastAt: number | null = null
  let current = ''
  let pendingMs = 0
  let qualified = false
  let total = 0
  return {
    sample(target: { slug: string; mode: AttentionMode } | null, now: number) {
      const delta = lastAt === null ? 0 : now - lastAt
      lastAt = now
      const key = target ? `${target.mode}:${target.slug}` : ''
      // Long gaps are suspended/throttled timers, never observation time.
      if (key !== current || delta < 0 || delta > 1000 || !target) {
        current = key
        pendingMs = 0
        qualified = false
        return
      }
      pendingMs += delta
      if (pendingMs < ATTENTION_MIN_MS) return
      const added = qualified ? delta : pendingMs
      if (total + added > ATTENTION_MAX_MS) return
      const row = rows.get(key) ?? { ...target, milliseconds: 0, episodes: 0 }
      row.milliseconds += added
      if (!qualified) row.episodes++
      qualified = true
      total += added
      rows.set(key, row)
    },
    snapshot: (): AttentionRow[] => [...rows.values()].map((row) => ({ ...row, milliseconds: Math.floor(row.milliseconds) })),
  }
}

export function attentionCandidate(input: {
  now: number; lastInput: number; enabled: boolean; visible: boolean; focused: boolean;
  walking: boolean; openId: string | null; ray: { slug: string | null; sampledAt: number };
}): { slug: string; mode: AttentionMode } | null {
  if (!input.enabled || !input.visible || !input.focused || input.now - input.lastInput >= ATTENTION_IDLE_MS) return null
  if (input.openId) return { slug: input.openId, mode: 'details' }
  return input.walking && input.ray.slug && input.now - input.ray.sampledAt < 750
    ? { slug: input.ray.slug, mode: 'view' } : null
}
