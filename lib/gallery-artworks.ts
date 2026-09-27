import { getFinalists, getFinalistsByIds, countryCodeToName, type Finalist } from '@/lib/finalists'
import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { site } from '@/lib/site'
import { flagSvg } from '@/lib/flag-svg'
import { gallerySlots, type Artwork } from '@/data/artworks'
import { MESSAGES } from '@/lib/i18n/messages'
import { fmt } from '@/lib/i18n/format'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

const EDITION_YEAR = new Date(site.deadlineISO).getFullYear()

// Golden ratio conjugate — multiplying an index by it and keeping the
// fractional part is a classic low-discrepancy ("Weyl") sequence: it spreads
// items out evenly while still looking arbitrary, and it's fully
// deterministic from the seed alone (no state to store or cron to run).
const GOLDEN_RATIO_CONJUGATE = 0.6180339887498949

// The exhibition day starts at 09:00 in Argentina (UTC-3, no DST), i.e.
// 12:00 UTC — so the obras change in the morning, not at 21:00 local.
const ROTATION_OFFSET_MS = 12 * 60 * 60 * 1000

// One stable seed per exhibition day — same visitors see the same 20 obras
// all day, and the selection rotates on its own at 09:00 Argentina.
function dailySeed(date = new Date()): number {
  const isoDay = new Date(date.getTime() - ROTATION_OFFSET_MS).toISOString().slice(0, 10)
  let hash = 0
  for (let i = 0; i < isoDay.length; i++) {
    hash = (hash * 31 + isoDay.charCodeAt(i)) >>> 0
  }
  return hash
}

function goldenShuffle<T>(items: T[], seed: number): T[] {
  return items
    .map((item, index) => {
      const value = (seed + index) * GOLDEN_RATIO_CONJUGATE
      return { item, key: value - Math.floor(value) }
    })
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item)
}

function describeArtwork(finalist: Finalist, locale: Locale): string {
  const m = MESSAGES[locale]
  const parts: string[] = []
  if (finalist.technique) {
    parts.push(fmt(m.gallery.artworkTechnique, { technique: m.common.techniques[finalist.technique] ?? finalist.technique }))
  }
  parts.push(countryCodeToName(finalist.countryCode, locale))
  return `${parts.join(' — ')}. ${fmt(m.gallery.artworkOfficial, { year: EDITION_YEAR })}`
}

// Today's stored lineup (supabase/migrations/20260925120000_exhibition_days.sql):
// no obra repeats until every published one has had its day. The first call
// of the day creates it. Empty when the table isn't there yet (migrations
// deploy separately from the app) or the call fails.
async function getStoredExhibition(): Promise<Finalist[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await createPublicClient().rpc('ensure_exhibition_today')
  if (error || !data?.length) {
    if (error) console.error('ensure_exhibition_today failed:', error.message)
    return []
  }
  const ids = (data as { slot: number; artwork_id: string }[]).map((row) => row.artwork_id)
  const finalists = await getFinalistsByIds(ids)
  return ids.flatMap((id) => finalists.get(id) ?? []).slice(0, gallerySlots.length)
}

// Today's obras, placed into the 3D gallery's wall slots and shown on the
// home. Re-runs on every request (both pages are force-dynamic), so the
// rotation needs no job of its own. Falls back to the stateless daily
// shuffle below (which can repeat obras) when there is no stored lineup.
export async function getDailyExhibition(): Promise<Finalist[]> {
  const stored = await getStoredExhibition()
  if (stored.length) return stored

  const finalists = await getFinalists()
  // Stable input order keeps both pages aligned even when creation dates tie.
  const ordered = [...finalists].sort((a, b) => a.slug.localeCompare(b.slug))
  return goldenShuffle(ordered, dailySeed()).slice(0, gallerySlots.length)
}

export async function getGalleryArtworks(locale: Locale = DEFAULT_LOCALE): Promise<Artwork[]> {
  const selected = await getDailyExhibition()

  return selected.map((finalist, index) => {
    const slot = gallerySlots[index]
    return {
      id: finalist.slug,
      title: finalist.artworkTitle ?? MESSAGES[locale].common.untitled,
      artist: finalist.name,
      countryCode: finalist.countryCode,
      flagSvg: flagSvg(finalist.countryCode),
      year: EDITION_YEAR,
      image: finalist.imageUrl,
      description: describeArtwork(finalist, locale),
      ...slot,
    }
  })
}
