// Add one entry per confirmed participant. countryCode is the 2-letter ISO code
// (AR, MX, ES, US, ...) used to render the flag next to their name.
export type Participant = {
  name: string
  countryCode: string
  // Not every submission records a technique, so keep this optional.
  technique?: string
}

export const participants: Participant[] = []

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
// ("Argentina"). Falls back to the raw code if the runtime can't resolve it.
export function countryCodeToName(countryCode: string) {
  return regionNames?.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase()
}
