// Jury MVP: who is a juror, which obras they score and how the scores rank.
// The pool is every obra preselected in /admin/obras — an `artworks` row or a
// sheet row (legacy_submissions), exactly as that grid shows them: an
// artwork linked from a sheet row is represented by the sheet row, so it's
// left out on the artworks side. Server-only (service role).
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { ADMIN_EMAILS } from '@/lib/admin'
import { site } from '@/lib/site'

export type JuryItem = {
  key: string
  // «#12»: the obra's place in the pool (oldest first), the same for every
  // juror and the admin, so an obra can be talked about by number.
  number: number
  imageUrl: string
  title: string | null
  technique: string | null
  // Only for the admin's ranking: jurors judge blind.
  artist: string | null
  countryCode: string | null
}

export type Juror = { id: string; email: string; name: string | null; active: boolean }

/** The active juror behind this session, if any. */
export async function jurorFor(db: SupabaseClient, user: User | null): Promise<Juror | null> {
  const email = user?.email?.trim().toLowerCase()
  if (!email) return null
  const { data } = await db.from('jurors').select('id, email, name, active').eq('email', email).eq('active', true).maybeSingle()
  return data
}

export const isAdminUser = (user: User | null) => ADMIN_EMAILS.includes(user?.email ?? '')

export async function getJuryPool(db: SupabaseClient): Promise<JuryItem[]> {
  const [artworks, legacy] = await Promise.all([
    db.from('artworks')
      .select('id, title, technique, image_url, created_at, profiles!inner(name, country_code)')
      .eq('review_status', 'preselected')
      .is('archived_at', null)
      .is('legacy_submission_id', null)
      .not('image_url', 'is', null)
      .order('created_at'),
    db.from('legacy_submissions')
      .select('id, title, technique, image_url, name, created_at')
      .eq('review_status', 'preselected')
      .is('archived_at', null)
      .not('image_url', 'is', null)
      .order('created_at'),
  ])
  if (artworks.error) throw new Error(artworks.error.message)
  if (legacy.error) throw new Error(legacy.error.message)
  type ArtworkRow = { id: string; title: string | null; technique: string | null; image_url: string; created_at: string; profiles: { name: string | null; country_code: string | null } | null }
  const items: (Omit<JuryItem, 'number'> & { createdAt: string })[] = [
    ...((artworks.data ?? []) as unknown as ArtworkRow[]).map((row) => ({
      key: `artwork:${row.id}`,
      imageUrl: row.image_url,
      title: row.title,
      technique: row.technique,
      artist: row.profiles?.name ?? null,
      countryCode: row.profiles?.country_code ?? null,
      createdAt: row.created_at,
    })),
    ...(legacy.data ?? []).map((row) => ({
      key: `legacy:${row.id}`,
      imageUrl: row.image_url as string,
      title: row.title,
      technique: row.technique,
      artist: row.name,
      countryCode: null,
      createdAt: row.created_at as string,
    })),
  ]
  return items
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map(({ createdAt: _createdAt, ...item }, i) => ({ ...item, number: i + 1 }))
}

/**
 * The order one juror sees the pool in: shuffled differently for each juror
 * (so the same obras don't always get the fresh eyes, or the tired ones) and
 * stable across visits — the shuffle is a hash of juror and obra.
 */
export function jurorOrder<T extends { key: string }>(items: T[], jurorId: string): T[] {
  const rank = (key: string) => createHash('sha256').update(`${jurorId}:${key}`).digest('hex')
  return items.map((item) => ({ item, rank: rank(item.key) })).sort((a, b) => (a.rank < b.rank ? -1 : 1)).map(({ item }) => item)
}

export type ScoreRow = { juror_id: string; item_key: string; score: number; comment: string | null }

export type RankedItem = JuryItem & {
  average: number | null
  // Mean of the obra's per-juror z-scores (see rankJuryPool); null when unscored.
  normalized: number | null
  votes: number
  // Sample standard deviation of the raw scores; null with fewer than 2 votes.
  spread: number | null
  min: number | null
  max: number | null
  // The jury split on it: worth talking about before closing the finalists.
  disputed: boolean
  comments: string[]
}

export type RankingMode = 'promedio' | 'normalizado'

// An obra «divided the jury» when two jurors are this far apart on the 1–10
// scale, or when its scores are this scattered overall.
export const DISPUTED_MIN_GAP = 5
export const DISPUTED_MIN_SPREAD = 2.5

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
// Sample sd (n − 1). The population sd is at most half the range, so with it
// the spread rule could never fire without the gap rule already firing.
// Callers guarantee ≥ 2 values.
const stdDev = (values: number[]) => {
  const m = mean(values)
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1))
}

/**
 * The pool ranked by average score (unscored last), ties broken by more
 * votes; or, in 'normalizado' mode, by each obra's mean z-score, so a strict
 * juror (3–5) and a generous one (7–9) pull with the same weight. Only active
 * jurors and scores on obras still in the pool count.
 */
export function rankJuryPool(pool: JuryItem[], scores: ScoreRow[], activeJurorIds: Set<string>, mode: RankingMode = 'promedio'): RankedItem[] {
  const poolKeys = new Set(pool.map((item) => item.key))
  const counted = scores.filter((s) => activeJurorIds.has(s.juror_id) && poolKeys.has(s.item_key))

  // Each juror's own scale over the current pool. With a single score or no
  // variation there is no scale to correct for, so their z is 0 (neutral).
  const byJuror = new Map<string, number[]>()
  for (const s of counted) byJuror.set(s.juror_id, [...(byJuror.get(s.juror_id) ?? []), s.score])
  const scale = new Map([...byJuror].map(([id, values]) => [id, { mean: mean(values), sd: values.length > 1 ? stdDev(values) : 0 }]))
  const z = (s: ScoreRow) => {
    const { mean: m, sd } = scale.get(s.juror_id)!
    return sd > 0 ? (s.score - m) / sd : 0
  }

  const byItem = new Map<string, ScoreRow[]>()
  for (const s of counted) byItem.set(s.item_key, [...(byItem.get(s.item_key) ?? []), s])

  const ranked = pool.map((item): RankedItem => {
    const rows = byItem.get(item.key) ?? []
    const values = rows.map((r) => r.score)
    const min = values.length ? Math.min(...values) : null
    const max = values.length ? Math.max(...values) : null
    const spread = values.length >= 2 ? stdDev(values) : null
    return {
      ...item,
      average: values.length ? mean(values) : null,
      normalized: rows.length ? mean(rows.map(z)) : null,
      votes: rows.length,
      spread,
      min,
      max,
      disputed: spread !== null && (max! - min! >= DISPUTED_MIN_GAP || spread >= DISPUTED_MIN_SPREAD),
      comments: rows.flatMap((row) => (row.comment?.trim() ? [row.comment.trim()] : [])),
    }
  })

  // Unscored obras always go last. Averages are ≥ 1, so -1 is enough there;
  // z-scores can be any sign, so nulls are handled explicitly.
  const byAverage = (a: RankedItem, b: RankedItem) => (b.average ?? -1) - (a.average ?? -1)
  const byNormalized = (a: RankedItem, b: RankedItem) => {
    if (a.normalized === null || b.normalized === null) return (a.normalized === null ? 1 : 0) - (b.normalized === null ? 1 : 0)
    return b.normalized - a.normalized
  }
  return ranked.sort(mode === 'normalizado'
    ? (a, b) => byNormalized(a, b) || b.votes - a.votes || byAverage(a, b)
    : (a, b) => byAverage(a, b) || b.votes - a.votes)
}

export const FINALISTS = site.jury.finalists

export const ITEM_KEY_PATTERN = /^(artwork|legacy):[0-9a-f-]{36}$/
