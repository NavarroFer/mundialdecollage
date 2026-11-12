// Matching for the map's country search: case- and accent-insensitive, so
// "peru" finds Perú and "mexico" finds México. Names that start with the
// query come first, then the ones that merely contain it.
export type SearchableCountry = { code: string; name: string }

export function foldSearchText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function searchCountries<T extends SearchableCountry>(countries: T[], query: string): T[] {
  const q = foldSearchText(query)
  if (!q) return countries
  const starts: T[] = []
  const contains: T[] = []
  for (const country of countries) {
    const name = foldSearchText(country.name)
    if (name.startsWith(q) || name.split(/[\s-]+/).some((word) => word.startsWith(q))) starts.push(country)
    else if (name.includes(q) || country.code.toLowerCase() === q) contains.push(country)
  }
  return [...starts, ...contains]
}
