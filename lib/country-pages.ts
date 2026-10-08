// The map shows a country's obras this many at a time, in the order
// /api/obras serves them (newest first), so a big country doesn't download
// hundreds of images at once and every one of them is a page away.
export const COUNTRY_PAGE_SIZE = 20

type CountryArtwork = { countryCode: string }

export function countryArtworks<T extends CountryArtwork>(artworks: T[], countryCode: string): T[] {
  return artworks.filter((artwork) => artwork.countryCode.toUpperCase() === countryCode)
}

export type Page<T> = {
  items: T[]
  // 0-based, clamped to the pages that exist.
  page: number
  pageCount: number
  total: number
  // 1-based positions of the first and last item shown (0 when empty).
  from: number
  to: number
}

/** The `page`-th (0-based) run of `size` items; out-of-range pages clamp to the nearest one. */
export function paginate<T>(items: T[], page: number, size = COUNTRY_PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(0, Math.floor(page) || 0), pageCount - 1)
  const start = current * size
  const shown = items.slice(start, start + size)
  return {
    items: shown,
    page: current,
    pageCount,
    total: items.length,
    from: shown.length ? start + 1 : 0,
    to: start + shown.length,
  }
}

export function countryPage<T extends CountryArtwork>(artworks: T[], countryCode: string, page: number): Page<T> {
  return paginate(countryArtworks(artworks, countryCode), page)
}
