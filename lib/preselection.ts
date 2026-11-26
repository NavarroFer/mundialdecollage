// Preselection (/admin/preseleccion): the organizers narrow every entered
// obra down to the jury's pool in passes over a mosaic — see
// supabase/migrations/20261126120000_preselection.sql.
//
// The pool is one slot per artist: the obra they chose, or, if they have
// several and never chose, one the organizers pick (preselection_choices).
// An artist who paid for more entries takes part with every entered obra,
// each in its own slot. Obras are read exactly as /admin/obras lists them: a
// Registro row stands for the artwork linked from it.
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllRows } from '@/lib/read-all-rows'
import { guessCountryCodeFromName } from '@/lib/participants'
import { STAGES, type Stage } from '@/lib/preselection-shared'
export { repeatedArtists } from '@/lib/preselection-shared'

export type PreselectionObra = {
  key: string
  imageUrl: string
  title: string | null
  technique: string | null
}

export type PreselectionSlot = {
  // The obra that fills it by default; picks are stored against this.
  key: string
  // The obra filling it now (the default, or the organizers' choice).
  obra: PreselectionObra
  artist: string
  countryCode: string | null
  // Same value for every slot of one artist (more than one only if they paid).
  artistKey: string
  // Other obras the organizers may put in the slot instead: only for an
  // artist with several who never chose. Includes the current one.
  alternatives: PreselectionObra[]
}

export type ArtworkInput = {
  id: string
  profile_id: string
  title: string | null
  technique: string | null
  image_url: string | null
  created_at: string
  is_selected: boolean
  is_entered: boolean
  legacy_submission_id: string | null
  profiles: { name: string | null; country_code: string | null; entries_chosen_at: string | null } | null
}

export type LegacyInput = {
  id: string
  email: string
  name: string | null
  country_raw: string | null
  title: string | null
  technique: string | null
  image_url: string | null
  selected: boolean
  claimed_by: string | null
  created_at: string
}

type Candidate = {
  obra: PreselectionObra
  artist: string
  countryCode: string | null
  artistKey: string
  chosen: boolean
  // The artist has said which obras take part (or only has one).
  confirmed: boolean
  paid: boolean
  createdAt: string
}

/**
 * Every slot of the pool, from the rows /admin/obras reads (artworks not
 * archived, not duplicates, not Club-only; Registro rows the same) and who
 * paid for more entries. `choices` maps a slot to the obra picked for it.
 */
export function buildPreselectionPool(
  artworks: ArtworkInput[],
  legacy: LegacyInput[],
  paidProfileIds: Set<string>,
  choices: Map<string, string> = new Map(),
): PreselectionSlot[] {
  const linked = new Map(artworks.filter((a) => a.legacy_submission_id).map((a) => [a.legacy_submission_id!, a]))
  const paidEntry = (a: ArtworkInput) => !a.is_selected && a.is_entered && paidProfileIds.has(a.profile_id)
  const candidates: Candidate[] = []

  for (const row of legacy) {
    if (!row.image_url) continue
    const artwork = linked.get(row.id)
    const profileId = row.claimed_by ?? artwork?.profile_id ?? null
    candidates.push({
      obra: { key: `legacy:${row.id}`, imageUrl: row.image_url, title: row.title, technique: row.technique ?? artwork?.technique ?? null },
      artist: row.name?.trim() || artwork?.profiles?.name?.trim() || 'Sin nombre',
      countryCode: artwork?.profiles?.country_code ?? (row.country_raw ? guessCountryCodeFromName(row.country_raw) ?? null : null),
      artistKey: profileId ? `profile:${profileId}` : `email:${row.email.trim().toLowerCase()}`,
      chosen: artwork ? artwork.is_selected || paidEntry(artwork) : row.selected,
      confirmed: Boolean(artwork?.profiles?.entries_chosen_at),
      paid: profileId ? paidProfileIds.has(profileId) : false,
      createdAt: row.created_at,
    })
  }
  for (const row of artworks) {
    if (row.legacy_submission_id || !row.is_entered || !row.image_url) continue
    candidates.push({
      obra: { key: `artwork:${row.id}`, imageUrl: row.image_url, title: row.title, technique: row.technique },
      artist: row.profiles?.name?.trim() || 'Sin nombre',
      countryCode: row.profiles?.country_code ?? null,
      artistKey: `profile:${row.profile_id}`,
      chosen: row.is_selected || paidEntry(row),
      confirmed: Boolean(row.profiles?.entries_chosen_at),
      paid: paidProfileIds.has(row.profile_id),
      createdAt: row.created_at,
    })
  }

  const byArtist = new Map<string, Candidate[]>()
  for (const candidate of candidates) byArtist.set(candidate.artistKey, [...(byArtist.get(candidate.artistKey) ?? []), candidate])

  const slots: PreselectionSlot[] = []
  for (const group of byArtist.values()) {
    // Newest first: the default when nobody chose, as /admin/obras does.
    group.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.obra.key < b.obra.key ? -1 : 1))
    const chosen = group.filter((c) => c.chosen)
    const slot = (c: Candidate, alternatives: PreselectionObra[]): PreselectionSlot => {
      const picked = alternatives.find((obra) => obra.key === choices.get(c.obra.key))
      return { key: c.obra.key, obra: picked ?? c.obra, artist: c.artist, countryCode: c.countryCode, artistKey: c.artistKey, alternatives }
    }
    if (chosen.length > 1 && chosen[0].paid) {
      // Paid for more entries: every entered obra takes part.
      for (const c of chosen) slots.push(slot(c, []))
      continue
    }
    const main = chosen[0] ?? group[0]
    const confirmed = group.length === 1 || group.some((c) => c.confirmed)
    slots.push(slot(main, confirmed ? [] : group.map((c) => c.obra)))
  }
  return slots
}

/** A stable shuffle, the same for everyone, and a different one for each stage. */
export function stageOrder<T extends { key: string }>(slots: T[], stage: Stage): T[] {
  const rank = (key: string) => createHash('sha256').update(`preseleccion:${stage}:${key}`).digest('hex')
  return slots.map((slot) => ({ slot, rank: rank(slot.key) })).sort((a, b) => (a.rank < b.rank ? -1 : 1)).map(({ slot }) => slot)
}

export type MarkRow = { stage: number; slot_key: string; picked: boolean; batch: number | null }

export type StageView<T> = {
  // Every slot in this stage, in its order.
  pool: T[]
  picked: Set<string>
  // Seen in a closed batch.
  seen: Set<string>
  // Not seen yet, in order: the next batch is a prefix of this.
  open: T[]
  lastBatch: number
}

/**
 * One stage over the pool: stage 1 holds every slot, each later stage the
 * slots picked in the stage before (still in the pool).
 */
export function stageView<T extends { key: string }>(slots: T[], marks: MarkRow[], stage: Stage): StageView<T> {
  const markOf = (s: number) => new Map(marks.filter((m) => m.stage === s).map((m) => [m.slot_key, m]))
  let pool = slots
  for (let s = 1; s < stage; s++) {
    const previous = markOf(s)
    pool = pool.filter((slot) => previous.get(slot.key)?.picked)
  }
  const own = markOf(stage)
  const ordered = stageOrder(pool, stage)
  const picked = new Set(ordered.filter((slot) => own.get(slot.key)?.picked).map((slot) => slot.key))
  const seen = new Set(ordered.filter((slot) => own.get(slot.key)?.batch != null).map((slot) => slot.key))
  const lastBatch = Math.max(0, ...[...own.values()].map((m) => m.batch ?? 0))
  return { pool: ordered, picked, seen, open: ordered.filter((slot) => !seen.has(slot.key)), lastBatch }
}

export type StageCounts = {
  total: number
  seen: number
  remaining: number
  // Picked among the seen ones.
  pickedSeen: number
  // Picked overall, including the batch on screen.
  picked: number
  // Where the pass ends at the pace so far; null before anything is seen.
  projected: number | null
  target: number
}

export function stageCounts<T extends { key: string }>(view: StageView<T>, targetPercent: number): StageCounts {
  const total = view.pool.length
  const seen = view.seen.size
  const pickedSeen = [...view.seen].filter((key) => view.picked.has(key)).length
  return {
    total,
    seen,
    remaining: total - seen,
    pickedSeen,
    picked: view.picked.size,
    projected: seen > 0 ? Math.round((pickedSeen / seen) * total) : null,
    target: Math.round((total * targetPercent) / 100),
  }
}

export const SLOT_KEY_PATTERN = /^(artwork|legacy):[0-9a-f-]{36}$/

/** Splits the final obras by table for public.preselection_send. */
export function splitObraKeys(keys: string[]) {
  const ids = (prefix: string) => keys.filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length))
  return { artworkIds: ids('artwork:'), legacyIds: ids('legacy:') }
}

export function parseStage(value: string | undefined): Stage {
  const n = Number(value)
  return (STAGES as readonly number[]).includes(n) ? (n as Stage) : 1
}

export function parseOption<T extends number>(value: string | undefined, options: readonly T[], fallback: T): T {
  const n = Number(value)
  return (options as readonly number[]).includes(n) ? (n as T) : fallback
}

/** Server-only (service role): the pool, the marks and the choices. */
export async function loadPreselection(db: SupabaseClient) {
  const [artworks, legacy, paid, choices, marks] = await Promise.all([
    readAllRows<ArtworkInput>((from, to) => db.from('artworks')
      .select('id, profile_id, title, technique, image_url, created_at, is_selected, is_entered, legacy_submission_id, profiles!inner(name, country_code, entries_chosen_at)')
      .eq('is_club_only', false)
      .is('archived_at', null)
      .is('duplicate_of', null)
      .order('created_at')
      .order('id')
      .range(from, to)),
    readAllRows<LegacyInput>((from, to) => db.from('legacy_submissions')
      .select('id, email, name, country_raw, title, technique, image_url, selected, claimed_by, created_at')
      .is('archived_at', null)
      .is('duplicate_of', null)
      .order('created_at')
      .order('id')
      .range(from, to)),
    db.from('entry_purchases').select('user_id').eq('status', 'paid'),
    readAllRows<{ slot_key: string; item_key: string }>((from, to) => db.from('preselection_choices').select('slot_key, item_key').order('slot_key').range(from, to)),
    readAllRows<MarkRow>((from, to) => db.from('preselection_marks').select('stage, slot_key, picked, batch').order('stage').order('slot_key').range(from, to)),
  ])
  if (paid.error) throw new Error(paid.error.message)
  const slots = buildPreselectionPool(
    artworks,
    legacy,
    new Set((paid.data ?? []).map((row) => row.user_id as string)),
    new Map(choices.map((row) => [row.slot_key, row.item_key])),
  )
  return { slots, marks }
}
