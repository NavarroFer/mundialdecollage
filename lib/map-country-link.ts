// Links into the home's map with a country already open: `#mapa-AR`. The
// flag ribbon uses them, and they work as shareable links too — no element
// has that id, so the browser leaves the scroll to WorldMap.
export const MAP_SECTION_ID = 'mapa'

// Fired when a link asks the (already mounted) map to open a country.
export const MAP_COUNTRY_EVENT = 'mapa:country'

const HASH_PREFIX = `#${MAP_SECTION_ID}-`

export function mapCountryHash(countryCode: string): string {
  return `${HASH_PREFIX}${countryCode.toUpperCase()}`
}

export function countryFromMapHash(hash: string): string | null {
  if (!hash.startsWith(HASH_PREFIX)) return null
  const code = hash.slice(HASH_PREFIX.length).toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

// No behavior option: the page's CSS scroll-behavior decides, which is
// smooth unless the visitor asked for reduced motion.
export function scrollToMap() {
  document.getElementById(MAP_SECTION_ID)?.scrollIntoView({ block: 'start' })
}
