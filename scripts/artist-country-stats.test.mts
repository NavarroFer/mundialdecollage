import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildArtistCountryStats } from '../lib/artist-country-stats.ts'

const registroHeader = ['Nombre', 'País', 'Email', 'Obra (Foto en Drive)']
const countryHeader = ['Nombre', 'País', 'Mail', 'Link de Drive de la foto']
describe('artistas del corte 21/9', () => {
  it('cuenta una vez por correo, independientemente de obras y filas repetidas', () => {
    assert.deepEqual(buildArtistCountryStats([
      registroHeader,
      ['Ana', 'Argentina', ' ANA@example.com ', 'foto1\nfoto2'],
      ['Ana', 'Argentina', 'ana@example.com', 'foto3'],
      ['Ana', 'Argentina', 'otra@example.com', 'foto4'],
    ], [countryHeader,
      ['Ana', 'Argentina', 'ana@example.com', 'foto'],
      ['Otra', 'Chile', 'otra@example.com', 'foto'],
    ]), { totalArtists: 2, countries: [{ country: 'Argentina', count: 1 }, { country: 'Chile', count: 1 }] })
  })
  it('filtra la fuente de países por los emails que siguen en Registro', () => {
    const stats = buildArtistCountryStats([registroHeader,
      ['A', '', 'a@example.com', 'foto'],
      ['B', '', 'b@example.com', 'foto'],
    ], [countryHeader,
      ['A', 'Canadá / Venezuela', 'a@example.com', 'foto'],
      ['Excluida', 'Chile', 'old@example.com', 'foto'],
    ])
    assert.equal(stats.countries.reduce((sum, row) => sum + row.count, 0), 2)
    assert.ok(stats.countries.some(row => row.country === 'Canadá / Venezuela' && row.count === 1))
    assert.ok(stats.countries.some(row => row.country === 'Sin país registrado' && row.count === 1))
  })
  it('rechaza conflictos, correos inválidos y una fuente vacía o equivocada', () => {
    assert.throws(() => buildArtistCountryStats([registroHeader, ['A', '', 'a@example.com', 'foto']], [countryHeader,
      ['A', 'Chile', 'a@example.com', 'foto'], ['A', 'Perú', 'a@example.com', 'foto'],
    ]), /países distintos/)
    assert.throws(() => buildArtistCountryStats([registroHeader, ['A', '', 'inválido']], [countryHeader]), /correo inválido/)
    assert.throws(() => buildArtistCountryStats([registroHeader], [countryHeader]), /vacía/)
    assert.throws(() => buildArtistCountryStats([['Nombre', 'País', 'Email']], [countryHeader]), /Encabezado/)
  })
  it('el Registro verificado suma 218 y muestra todas las categorías de país', () => {
    const snapshot = JSON.parse(readFileSync(new URL('../data/artist-country-stats.json', import.meta.url), 'utf8'))
    assert.equal(snapshot.totalArtists, 218)
    assert.equal(snapshot.countries.reduce((sum: number, row: { count: number }) => sum + row.count, 0), 218)
    assert.equal(snapshot.countries.length, 22)
  })
})
