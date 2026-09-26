import { countryCodeToName, guessCountryCodeFromName } from '@/lib/participants'

export type CountryCount = { country: string; countryCode?: string; count: number }

// Registro (data/artist-country-stats.json) is the curated artist count per
// country, but it's a snapshot synced by hand — a published obra from a
// country Registro doesn't list yet would otherwise stay grey on the map and
// missing from the ranking. Those countries join with their published-obra
// count (one selected obra per artist) until the next sync catches up.
// Composite or missing Registro labels stay in the ranking without a code.
export function buildCountryBreakdown(
  registro: { country: string; count: number }[],
  publishedCountryCodes: string[],
): CountryCount[] {
  const breakdown: CountryCount[] = registro.map(({ country, count }) => ({
    country,
    count,
    countryCode: guessCountryCodeFromName(country),
  }))
  const listed = new Set(breakdown.map((b) => b.countryCode))
  const unlisted = new Map<string, number>()
  for (const raw of publishedCountryCodes) {
    const code = raw.toUpperCase()
    if (!listed.has(code)) unlisted.set(code, (unlisted.get(code) ?? 0) + 1)
  }
  for (const [countryCode, count] of unlisted) {
    breakdown.push({ country: countryCodeToName(countryCode), countryCode, count })
  }
  return breakdown.sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, 'es'))
}
