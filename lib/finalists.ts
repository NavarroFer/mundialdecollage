// Add one entry per confirmed finalist once the Mundial announces them. slug
// feeds the individual work page route (/obras/[slug]) — keep it URL-safe
// (lowercase, hyphens). countryCode is the 2-letter ISO code (AR, MX, ES,
// US, ...) used to render the flag + country name. instagram/website are
// optional and should only be filled in when the artist authorizes sharing
// them (ver ROADMAP.md, sección "Primera Edición").
export type Finalist = {
  slug: string
  name: string
  countryCode: string
  artworkTitle: string
  technique: string
  imageUrl: string
  instagram?: string
  website?: string
}

export const finalists: Finalist[] = []

export function getFinalistBySlug(slug: string) {
  return finalists.find((finalist) => finalist.slug === slug)
}

// Converts an ISO 3166-1 alpha-2 code ("AR") into its Spanish country name
// ("Argentina"). Falls back to the raw code if the runtime can't resolve it.
export function countryCodeToName(countryCode: string) {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(countryCode.toUpperCase()) ?? countryCode
  } catch {
    return countryCode
  }
}
