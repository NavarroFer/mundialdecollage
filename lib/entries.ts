import { site } from '@/lib/site'

// An artist keeps any number of obras (up to site.entries.maxStored) but
// only postulates some of them: one for free, up to paidLimit after the
// one-time payment. The obra that represents them on the public site
// (is_selected) is always one of the postulated ones (is_entered) — see
// supabase/migrations/20260926130000_artwork_entries.sql.

export function entryLimit(hasPaid: boolean) {
  return hasPaid ? site.entries.paidLimit : site.entries.freeLimit
}

// Someone with several obras who never chose is sent to choose first: an
// artist who sent more than one by mail, or uploaded another one.
export function needsEntryChoice(artworkCount: number, entriesChosenAt: string | null | undefined) {
  return artworkCount > 1 && !entriesChosenAt
}

export type EntryChoice =
  | { ok: true; entered: string[]; main: string }
  | { ok: false; error: 'none' | 'too_many' | 'not_owned' }

// Validates what the artist submitted on /onboarding/obras against the obras
// they actually own and their limit. The main obra is the one they marked,
// else the one that already represented them if it's still postulated, else
// the first postulated one.
export function resolveEntryChoice({
  ownedIds,
  requestedIds,
  mainId,
  currentMainId,
  limit,
}: {
  ownedIds: string[]
  requestedIds: string[]
  mainId?: string | null
  currentMainId?: string | null
  limit: number
}): EntryChoice {
  const owned = new Set(ownedIds)
  const entered = [...new Set(requestedIds.filter(Boolean))]
  if (entered.length === 0) return { ok: false, error: 'none' }
  if (entered.some((id) => !owned.has(id))) return { ok: false, error: 'not_owned' }
  if (entered.length > limit) return { ok: false, error: 'too_many' }

  const main =
    mainId && entered.includes(mainId)
      ? mainId
      : currentMainId && entered.includes(currentMainId)
        ? currentMainId
        : entered[0]
  return { ok: true, entered, main }
}
