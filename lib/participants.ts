import { createPublicClient } from '@/lib/supabase/public'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isoNumericToAlpha2 } from '@/lib/iso-numeric-country-codes'

// countryCode is the 2-letter ISO code (AR, MX, ES, US, ...) used to render
// the flag next to their name.
export type Participant = {
  name: string
  countryCode: string
  // Not every submission records a technique, so keep this optional.
  technique?: string
}

// Every *published* submission (see app/admin/obras/ — an admin has to mark
// each one public before it shows up anywhere), newest first. Returns []
// until real credentials are wired up or nothing's been published yet.
export async function getParticipants(options?: { limit?: number }): Promise<Participant[]> {
  if (!isSupabaseConfigured) return []

  let query = createPublicClient()
    .from('profiles')
    .select('name, country_code, technique')
    .not('onboarded_at', 'is', null)
    .order('onboarded_at', { ascending: false })

  if (options?.limit) query = query.limit(options.limit)

  const { data } = await query
  return (data ?? [])
    .filter((row) => row.name && row.country_code)
    .map((row) => ({
      name: row.name as string,
      countryCode: row.country_code as string,
      technique: row.technique ?? undefined,
    }))
}

// Converts an ISO 3166-1 alpha-2 code ("AR") into its flag emoji (🇦🇷).
export function countryCodeToFlag(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

// Resolves country names ("Argentina") from the runtime's own locale data, so
// there's no hardcoded country list to keep in sync here.
const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['es'], { type: 'region' })
    : undefined

// Converts an ISO 3166-1 alpha-2 code ("AR") into its Spanish display name
// ("Argentina"). Falls back to the raw code if the runtime can't resolve it
// — Intl.DisplayNames.of() *throws* (not just returns undefined) for a code
// that isn't well-formed (empty, one letter, three letters), so this needs a
// try/catch, not just `??`. country_code is normally constrained by the
// onboarding form's <select>, but this keeps a stray/malformed value from
// crashing the whole page instead of just showing the raw code.
export function countryCodeToName(countryCode: string) {
  try {
    return regionNames?.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase()
  } catch {
    return countryCode.toUpperCase()
  }
}

// Every ISO 3166-1 alpha-2 country code, for the registration form's country
// picker — reuses the same code list already bundled for the world map
// (lib/iso-numeric-country-codes.ts), sorted for a stable render order.
export function getAllCountryCodes(): string[] {
  return Object.values(isoNumericToAlpha2).sort()
}
