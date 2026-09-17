// Add one entry per confirmed participant. countryCode is the 2-letter ISO code
// (AR, MX, ES, US, ...) used to render the flag next to their name.
export type Participant = {
  name: string
  countryCode: string
  // Not every submission records a technique, so keep this optional.
  technique?: string
}

// DEMO mock data — for showing the design with sample data. Remove before
// launch (revert to an empty array) so real numbers aren't faked.
export const participants: Participant[] = [
  { name: 'Sofía Ramírez', countryCode: 'AR', technique: 'Collage analógico' },
  { name: 'Federico Gómez', countryCode: 'AR', technique: 'Collage digital' },
  { name: 'Martina Acosta', countryCode: 'AR', technique: 'Collage analógico' },
  { name: 'Julián Paz', countryCode: 'AR' },
  { name: 'Rocío Benítez', countryCode: 'AR', technique: 'Fotomontaje' },
  { name: 'Diego Herrera', countryCode: 'MX' },
  { name: 'Renata Cruz', countryCode: 'MX', technique: 'Collage analógico' },
  { name: 'Lucía Fernández', countryCode: 'ES', technique: 'Fotomontaje' },
  { name: 'Laura Jiménez', countryCode: 'ES', technique: 'Collage analógico' },
  { name: 'Camila Torres', countryCode: 'CL' },
  { name: 'Valentina Rojas', countryCode: 'CO', technique: 'Collage analógico' },
  { name: 'Ana Belén Suárez', countryCode: 'PE' },
  { name: 'Julieta Medina', countryCode: 'UY', technique: 'Collage analógico' },
  { name: 'Pedro Silva', countryCode: 'BR', technique: 'Fotomontaje' },
  { name: 'Bianca Souza', countryCode: 'BR' },
  { name: 'Clara Dubois', countryCode: 'FR' },
  { name: 'Mateo Alviani', countryCode: 'IT', technique: 'Collage digital' },
  { name: 'Emma Johnson', countryCode: 'US', technique: 'Collage digital' },
  { name: 'Hannah Weber', countryCode: 'DE' },
  { name: 'Noa Cohen', countryCode: 'IL' },
]

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
