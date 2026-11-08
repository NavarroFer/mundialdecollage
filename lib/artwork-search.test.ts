import { describe, expect, it, vi } from 'vitest'
import { buildSearchIndex, normalizeSearch, searchArtists, searchArtworks, searchIndex, type SearchEntry } from './artwork-search'

const countries: Record<string, string> = { AR: 'Argentina', MX: 'México', ES: 'España' }
const countryName = (code: string) => countries[code] ?? code

const entries: SearchEntry[] = [
  { slug: 'gilda', title: 'Gilda', name: 'Alejandro Restagno', countryCode: 'AR' },
  { slug: 'mia', title: 'My mother is an alien', name: 'Iván Estrada', countryCode: 'MX' },
  { slug: 'dona', title: 'Dona', name: 'Alejandra Moschini', countryCode: 'ES' },
  { slug: 'sueltate', title: 'Suéltate la trenza', name: 'Moni Losada', countryCode: 'AR' },
]
const slugs = (query: string) => searchArtworks(entries, query, countryName).map((e) => e.slug)

describe('searchArtworks', () => {
  it('ignora mayúsculas y tildes', () => {
    expect(normalizeSearch('  Suéltate MÉXICO ')).toBe('sueltate mexico')
    expect(slugs('ivan')).toEqual(['mia'])
    expect(slugs('SUELTATE')).toEqual(['sueltate'])
  })

  it('busca por título, artista o país, y exige todas las palabras', () => {
    expect(slugs('mexico')).toEqual(['mia'])
    expect(slugs('argentina')).toEqual(['gilda', 'sueltate'])
    expect(slugs('alejandr argentina')).toEqual(['gilda'])
  })

  it('pone primero lo que empieza con lo buscado', () => {
    expect(slugs('dona')).toEqual(['dona'])
    expect(slugs('mo')).toEqual(['sueltate', 'mia', 'dona'])
  })

  it('no devuelve nada sin texto y respeta el límite', () => {
    expect(slugs('   ')).toEqual([])
    expect(searchArtworks(entries, 'a', countryName, 2)).toHaveLength(2)
  })

  it('returns every match from the index, and names each country only once', () => {
    const many = Array.from({ length: 30 }, (_, n) => ({ slug: `o${n}`, title: null, name: `Ana ${n}`, countryCode: 'PE' }))
    const name = vi.fn(() => 'Perú')
    const index = buildSearchIndex(many, name)
    expect(searchIndex(index, 'peru')).toHaveLength(30)
    expect(searchIndex(index, 'ana')).toHaveLength(30)
    expect(name).toHaveBeenCalledTimes(1)
  })
})

describe('searchArtists', () => {
  const withProfiles: SearchEntry[] = [
    { slug: 'gilda', title: 'Gilda', name: 'Alejandro Restagno', countryCode: 'AR', profileId: 'p1' },
    { slug: 'gilda-2', title: 'Otra', name: 'Alejandro Restagno', countryCode: 'AR', profileId: 'p1' },
    { slug: 'dona', title: 'Dona', name: 'Alejandra Moschini', countryCode: 'ES', profileId: 'p2' },
    { slug: 'mia', title: 'Alejandro en la luna', name: 'Iván Estrada', countryCode: 'MX', profileId: 'p3' },
    { slug: 'sin', title: 'Sin perfil', name: 'Alejo Nadie', countryCode: 'AR' },
  ]
  const index = buildSearchIndex(withProfiles, countryName)

  it('finds each artist once, counting their obras, by name only', () => {
    expect(searchArtists(index, 'alejandro')).toEqual([
      { profileId: 'p1', name: 'Alejandro Restagno', countryCode: 'AR', artworks: 2 },
    ])
  })

  it('ranks a name starting with the query first and caps the list', () => {
    expect(searchArtists(index, 'ale').map((a) => a.profileId)).toEqual(['p1', 'p2'])
    expect(searchArtists(index, 'a', 1)).toHaveLength(1)
  })

  it('ignores countries, titles and entries without a profile', () => {
    expect(searchArtists(index, 'argentina')).toEqual([])
    expect(searchArtists(index, 'luna')).toEqual([])
    expect(searchArtists(index, 'alejo')).toEqual([])
  })
})
