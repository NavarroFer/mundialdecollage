// The map shows at most this many obras per country, drawn at random on every
// tap, so a big country doesn't download hundreds of images at once and the
// same ones don't always lead.
export const COUNTRY_SAMPLE_SIZE = 20

type CountryArtwork = { countryCode: string }

export function countryArtworks<T extends CountryArtwork>(artworks: T[], countryCode: string): T[] {
  return artworks.filter((artwork) => artwork.countryCode.toUpperCase() === countryCode)
}

/** Up to `size` items picked uniformly at random (partial Fisher–Yates). */
export function randomSample<T>(items: T[], size = COUNTRY_SAMPLE_SIZE, random = Math.random): T[] {
  const pool = [...items]
  const count = Math.min(size, pool.length)
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

export function sampleCountryArtworks<T extends CountryArtwork>(artworks: T[], countryCode: string): T[] {
  return randomSample(countryArtworks(artworks, countryCode))
}
