// Jury MVP: who is a juror, which obras they score and how the scores rank.
// The pool is every obra preselected in /admin/obras — an `artworks` row or a
// sheet row (legacy_submissions), exactly as that grid shows them: an
// artwork linked from a sheet row is represented by the sheet row, so it's
// left out on the artworks side. Server-only (service role).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { ADMIN_EMAILS } from '@/lib/admin'

export type JuryItem = {
  key: string
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
      .select('id, title, technique, image_url, profiles!inner(name, country_code)')
      .eq('review_status', 'preselected')
      .is('archived_at', null)
      .is('legacy_submission_id', null)
      .not('image_url', 'is', null)
      .order('created_at'),
    db.from('legacy_submissions')
      .select('id, title, technique, image_url, name, country_raw')
      .eq('review_status', 'preselected')
      .is('archived_at', null)
      .not('image_url', 'is', null)
      .order('created_at'),
  ])
  if (artworks.error) throw new Error(artworks.error.message)
  if (legacy.error) throw new Error(legacy.error.message)
  type ArtworkRow = { id: string; title: string | null; technique: string | null; image_url: string; profiles: { name: string | null; country_code: string | null } | null }
  return [
    ...((artworks.data ?? []) as unknown as ArtworkRow[]).map((row) => ({
      key: `artwork:${row.id}`,
      imageUrl: row.image_url,
      title: row.title,
      technique: row.technique,
      artist: row.profiles?.name ?? null,
      countryCode: row.profiles?.country_code ?? null,
    })),
    ...(legacy.data ?? []).map((row) => ({
      key: `legacy:${row.id}`,
      imageUrl: row.image_url as string,
      title: row.title,
      technique: row.technique,
      artist: row.name,
      countryCode: null,
    })),
  ]
}

export type ScoreRow = { juror_id: string; item_key: string; score: number; comment: string | null }

export type RankedItem = JuryItem & { average: number | null; votes: number; comments: string[] }

/**
 * The pool ranked by average score (unscored last), ties broken by more
 * votes. Only active jurors count.
 */
export function rankJuryPool(pool: JuryItem[], scores: ScoreRow[], activeJurorIds: Set<string>): RankedItem[] {
  const byItem = new Map<string, ScoreRow[]>()
  for (const score of scores) {
    if (!activeJurorIds.has(score.juror_id)) continue
    const list = byItem.get(score.item_key) ?? []
    list.push(score)
    byItem.set(score.item_key, list)
  }
  return pool
    .map((item) => {
      const rows = byItem.get(item.key) ?? []
      const average = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : null
      return { ...item, average, votes: rows.length, comments: rows.flatMap((row) => (row.comment?.trim() ? [row.comment.trim()] : [])) }
    })
    .sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || b.votes - a.votes)
}

export const FINALISTS = 30

export const ITEM_KEY_PATTERN = /^(artwork|legacy):[0-9a-f-]{36}$/
