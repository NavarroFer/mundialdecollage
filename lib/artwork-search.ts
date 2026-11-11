// The homepage search (components/artwork-search.tsx) filters every published
// obra in the browser: a few hundred rows fit in one small cached response,
// so each keystroke answers instantly instead of waiting on a request.
export type SearchEntry = {
  slug: string
  // Empty when the obra has no title yet (shown as m.common.untitled).
  title: string | null
  name: string
  countryCode: string
  // The artist's profile, to offer it as a result of its own (searchArtists).
  profileId?: string
}

// What /api/obras serves: the search's fields plus the photo, which the
// home's map draws its cards from (components/world-map-lazy.tsx), and the
// obra's tags as indexes into COMMUNITY_TAGS, for «Para vos» in the browser.
export type ObraEntry = SearchEntry & { imageUrl: string; technique?: string | null; tags?: number[] }

// Lowercase and without accents, so "jose" finds "José" and "mexico" finds
// "México".
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

type IndexedEntry<Entry> = { entry: Entry; title: string; name: string; haystack: string }

// Built once per list and language: normalizing and naming the countries of
// every obra again on each keystroke is the part of a search that costs.
export function buildSearchIndex<Entry extends SearchEntry>(
  entries: Entry[],
  countryName: (code: string) => string,
): IndexedEntry<Entry>[] {
  const names = new Map<string, string>()
  const country = (code: string) => {
    let known = names.get(code)
    if (known === undefined) names.set(code, known = `${normalizeSearch(countryName(code))} ${code.toLowerCase()}`)
    return known
  }
  return entries.map((entry) => {
    const title = normalizeSearch(entry.title ?? '')
    const name = normalizeSearch(entry.name)
    return { entry, title, name, haystack: `${title} ${name} ${country(entry.countryCode)}` }
  })
}

// Every word typed has to appear in the title, the artist or the country
// (in the reader's language). A title or name starting with the query ranks
// first, then words starting with it, then matches anywhere. All the matches:
// the search box shows them a page at a time.
export function searchIndex<Entry>(index: IndexedEntry<Entry>[], query: string): Entry[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const whole = words.join(' ')

  const ranked: { entry: Entry; score: number }[] = []
  for (const { entry, title, name, haystack } of index) {
    if (!words.every((word) => haystack.includes(word))) continue
    const score = name.startsWith(whole) || title.startsWith(whole) ? 0
      : ` ${name} ${title}`.includes(` ${whole}`) ? 1
      : 2
    ranked.push({ entry, score })
  }
  return ranked
    .sort((a, b) => a.score - b.score)
    .map(({ entry }) => entry)
}

export type ArtistMatch = { profileId: string; name: string; countryCode: string; artworks: number }

// The artists whose name holds every word typed, each once, for the rows that
// lead to their profile above the obras. Same ranking as searchIndex: a name
// starting with the query first.
export function searchArtists<Entry extends SearchEntry>(index: IndexedEntry<Entry>[], query: string, limit = 3): ArtistMatch[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const whole = words.join(' ')
  const found = new Map<string, ArtistMatch & { score: number }>()
  for (const { entry, name } of index) {
    if (!entry.profileId || !words.every((word) => name.includes(word))) continue
    const known = found.get(entry.profileId)
    if (known) { known.artworks += 1; continue }
    const score = name.startsWith(whole) ? 0 : ` ${name}`.includes(` ${whole}`) ? 1 : 2
    found.set(entry.profileId, { profileId: entry.profileId, name: entry.name, countryCode: entry.countryCode, artworks: 1, score })
  }
  return [...found.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ score: _score, ...match }) => match)
}

export function searchArtworks<Entry extends SearchEntry>(
  entries: Entry[],
  query: string,
  countryName: (code: string) => string,
  limit = 8,
): Entry[] {
  return searchIndex(buildSearchIndex(entries, countryName), query).slice(0, limit)
}
