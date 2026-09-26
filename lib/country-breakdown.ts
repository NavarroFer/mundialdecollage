import { countryCodeToName } from '@/lib/participants'

// null = the profile has no country on file yet.
export type CountryCount = { countryCode: string | null; count: number }

// Tallies live rows by country, biggest first, ties alphabetical by Spanish
// name, with "no country" always last so it never reads as a leading country.
export function countByCountry(codes: (string | null | undefined)[]): CountryCount[] {
  const counts = new Map<string | null, number>()
  for (const raw of codes) {
    const code = raw?.trim().toUpperCase() || null
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  const name = (code: string | null) => (code ? countryCodeToName(code) : '')
  return [...counts]
    .map(([countryCode, count]) => ({ countryCode, count }))
    .sort(
      (a, b) =>
        Number(a.countryCode === null) - Number(b.countryCode === null) ||
        b.count - a.count ||
        name(a.countryCode).localeCompare(name(b.countryCode), 'es'),
    )
}
