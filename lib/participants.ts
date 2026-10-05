import { COUNTRY_CODES } from '@/lib/country-codes'

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
