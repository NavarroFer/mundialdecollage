// What /admin/preseleccion shares between the server page and the mosaic in
// the browser (lib/preselection.ts is server-only).
import { normalizeSearch } from '@/lib/artwork-search'

export const STAGES = [1, 2, 3] as const
export type Stage = (typeof STAGES)[number]
export const STAGE_LABELS: Record<Stage, string> = { 1: '1ª pasada', 2: '2ª pasada', 3: 'Mesa final' }
// The last stage is seen all at once, not in batches.
export const FINAL_STAGE: Stage = 3

export const BATCH_SIZES = [10, 15, 20, 30] as const
export const COLUMN_COUNTS = [2, 3, 4, 5, 6, 8] as const
export const TARGET_PERCENTS = [10, 15, 20, 25, 30] as const
export const DEFAULT_BATCH_SIZE = 20
export const DEFAULT_COLUMNS = 5
// What share of each pass the organizers aim to keep: a reference for the
// counters, never a cap.
export const DEFAULT_TARGET_PERCENT = 20

/**
 * Artists with more than one picked slot: only one obra per artist may go to
 * the jury. Matched by account or email, and also by name, since someone who
 * sent an obra by mail and later uploaded another under a different email
 * looks like two artists.
 */
export function repeatedArtists<T extends { key: string; artistKey: string; artist: string }>(slots: T[], picked: Set<string>) {
  const chosen = slots.filter((slot) => picked.has(slot.key))
  const nameKey = (slot: T) => {
    const name = normalizeSearch(slot.artist).replace(/\s+/g, ' ')
    return name && name !== 'sin nombre' ? `name:${name}` : slot.artistKey
  }
  // Union of the two keys: slots sharing either one are the same artist.
  const parent = new Map<string, string>()
  const find = (key: string): string => {
    const up = parent.get(key) ?? key
    if (up === key) return key
    const root = find(up)
    parent.set(key, root)
    return root
  }
  for (const slot of chosen) parent.set(find(slot.artistKey), find(nameKey(slot)))
  const groups = new Map<string, T[]>()
  for (const slot of chosen) {
    const root = find(slot.artistKey)
    groups.set(root, [...(groups.get(root) ?? []), slot])
  }
  return [...groups.values()].filter((list) => list.length > 1)
}
