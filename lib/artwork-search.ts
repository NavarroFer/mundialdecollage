// The homepage search (components/artwork-search.tsx) filters every published
// obra in the browser: a few hundred rows fit in one small cached response,
// so each keystroke answers instantly instead of waiting on a request.
export type SearchEntry = {
  slug: string
  // Empty when the obra has no title yet (shown as m.common.untitled).
  title: string | null
  name: string
  countryCode: string
}

// What /api/obras serves: the search's fields plus the photo, which the
// home's map draws its cards from (components/world-map-lazy.tsx).
export type ObraEntry = SearchEntry & { imageUrl: string }

// Lowercase and without accents, so "jose" finds "José" and "mexico" finds
// "México".
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

// Every word typed has to appear in the title, the artist or the country
// (in the reader's language). A title or name starting with the query ranks
// first, then words starting with it, then matches anywhere.
export function searchArtworks(
  entries: SearchEntry[],
  query: string,
  countryName: (code: string) => string,
  limit = 8,
): SearchEntry[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const whole = words.join(' ')

  const ranked: { entry: SearchEntry; score: number }[] = []
  for (const entry of entries) {
    const title = normalizeSearch(entry.title ?? '')
    const name = normalizeSearch(entry.name)
    const haystack = `${title} ${name} ${normalizeSearch(countryName(entry.countryCode))} ${entry.countryCode.toLowerCase()}`
    if (!words.every((word) => haystack.includes(word))) continue
    const score = name.startsWith(whole) || title.startsWith(whole) ? 0
      : ` ${name} ${title}`.includes(` ${whole}`) ? 1
      : 2
    ranked.push({ entry, score })
  }
  return ranked
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ entry }) => entry)
}
