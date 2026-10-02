import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { COUNTRY_CODES } from '@/lib/country-codes'
import { cachedPublicData } from '@/lib/public-data-cache'

// countryCode is the 2-letter ISO code (AR, MX, ES, US, ...) used to render
// the flag next to their name.
export type Participant = {
  name: string
  countryCode: string
  // Not every submission records a technique, so keep this optional.
  technique?: string
  // Full profile URL, when the artist has one on file.
  instagram?: string
}

// Every *curated and published* submission (see app/admin/obras/ — an admin
// has to select an artwork as the artist's final one and mark it public
// before it shows up anywhere), newest first. Returns [] until real
// credentials are wired up or nothing's been published yet.
export const getParticipants = cachedPublicData(async (options?: { limit?: number }): Promise<Participant[]> => {
  if (!isSupabaseConfigured) return []

  let query = createPublicClient()
    .from('artworks')
    .select('technique, profiles!inner(name, country_code, instagram)')
    .eq('is_selected', true)
    .order('created_at', { ascending: false })

  if (options?.limit) query = query.limit(options.limit)

  const { data } = await query
  return ((data ?? []) as unknown as Array<{
    technique: string | null
    profiles: { name: string | null; country_code: string | null; instagram: string | null } | null
  }>)
    .filter((row) => row.profiles?.name && row.profiles?.country_code)
    .map((row) => ({
      name: row.profiles!.name as string,
      countryCode: row.profiles!.country_code as string,
      technique: row.technique ?? undefined,
      instagram: row.profiles!.instagram ?? undefined,
    }))
}, 'participants')

// Converts an ISO 3166-1 alpha-2 code ("AR") into its flag emoji (🇦🇷).
export function countryCodeToFlag(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

// The techniques the onboarding form offers. Stored as these Spanish values;
// each dictionary's common.techniques holds the label to show.
export const TECHNIQUES = ['Analógica', 'Mixta', 'Digital'] as const

// Resolves country names ("Argentina") from the runtime's own locale data, so
// there's no hardcoded country list to keep in sync here. One formatter per
// language, built on first use.
const regionNamesByLocale = new Map<string, Intl.DisplayNames | undefined>()
function regionNames(locale: string) {
  if (!regionNamesByLocale.has(locale)) {
    regionNamesByLocale.set(
      locale,
      typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames([locale], { type: 'region' }) : undefined,
    )
  }
  return regionNamesByLocale.get(locale)
}

// Converts an ISO 3166-1 alpha-2 code ("AR") into its display name in
// `locale` — Spanish ("Argentina") unless the reader's language is passed.
// Falls back to the raw code if the runtime can't resolve it
// — Intl.DisplayNames.of() *throws* (not just returns undefined) for a code
// that isn't well-formed (empty, one letter, three letters), so this needs a
// try/catch, not just `??`. country_code is normally constrained by the
// onboarding form's <select>, but this keeps a stray/malformed value from
// crashing the whole page instead of just showing the raw code.
export function countryCodeToName(countryCode: string, locale = 'es') {
  try {
    return regionNames(locale)?.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase()
  } catch {
    return countryCode.toUpperCase()
  }
}

// Every country code the registration form's picker offers (and the server
// accepts) — see lib/country-codes.ts — sorted for a stable render order.
export function getAllCountryCodes(): string[] {
  return [...COUNTRY_CODES].sort()
}

function normalizeCountryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Built once, not per call — Intl.DisplayNames.of() is comparatively
// expensive to run 250-ish times on every lookup.
let countryNameToCode: Map<string, string> | undefined
function getCountryNameToCode() {
  if (!countryNameToCode) {
    countryNameToCode = new Map(getAllCountryCodes().map((code) => [normalizeCountryName(countryCodeToName(code)), code]))
  }
  return countryNameToCode
}

// Best-effort reverse of countryCodeToName, for free-text country names that
// were never picked from the onboarding <select> — namely legacy_submissions.
// country_raw (see supabase/migrations/20260919000000_legacy_submissions.sql),
// hand-salvaged from a spreadsheet rather than backed by a real ISO code.
// Matches case/accent-insensitively ("Mexico" ~ "México") but doesn't try to
// fix typos or non-Spanish spellings — returns undefined rather than guessing
// wrong for anything that doesn't cleanly match a real country name.
export function guessCountryCodeFromName(name: string): string | undefined {
  return getCountryNameToCode().get(normalizeCountryName(name))
}
