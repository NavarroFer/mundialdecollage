// Add one entry per confirmed participant. countryCode is the 2-letter ISO code
// (AR, MX, ES, US, ...) used to render the flag next to their name.
export type Participant = {
  name: string
  countryCode: string
}

export const participants: Participant[] = []

// Converts an ISO 3166-1 alpha-2 code ("AR") into its flag emoji (🇦🇷).
export function countryCodeToFlag(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}
