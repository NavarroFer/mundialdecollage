import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildArtistCountryStats } from '../lib/artist-country-stats.ts'

const header = ['Nombre', 'País', 'Mail', 'Link de Drive de la foto']
describe('artistas del corte 21/9', () => {
  it('cuenta una vez por correo, independientemente de obras y filas repetidas', () => {
    assert.deepEqual(buildArtistCountryStats([
      header,
      ['Ana', 'Argentina', ' ANA@example.com ', 'foto1\nfoto2'],
      ['Ana', 'Argentina', 'ana@example.com', 'foto3'],
      ['Ana', 'Argentina', 'otra@example.com', 'foto4'],
    ]), { totalArtists: 2, countries: [{ country: 'Argentina', count: 2 }] })
  })
  it('incluye países dobles y sin país una sola vez para que cierre la suma', () => {
    const stats = buildArtistCountryStats([header,
      ['A', 'Canadá / Venezuela', 'a@example.com', 'foto'],
      ['B', '', 'b@example.com', 'foto'],
    ])
    assert.equal(stats.countries.reduce((sum, row) => sum + row.count, 0), 2)
    assert.ok(stats.countries.some(row => row.country === 'Canadá / Venezuela' && row.count === 1))
    assert.ok(stats.countries.some(row => row.country === 'Sin país registrado' && row.count === 1))
  })
  it('rechaza conflictos, correos inválidos y una fuente vacía o equivocada', () => {
    assert.throws(() => buildArtistCountryStats([header,
      ['A', 'Chile', 'a@example.com', 'foto'],
      ['A', 'Perú', 'a@example.com', 'foto'],
    ]), /países distintos/)
    assert.throws(() => buildArtistCountryStats([header, ['A', 'Chile', 'inválido']]), /correo inválido/)
    assert.throws(() => buildArtistCountryStats([header]), /vacía/)
    assert.throws(() => buildArtistCountryStats([['Nombre', 'País', 'Email']]), /Encabezado/)
  })
  it('el corte verificado suma 230 y muestra todas las categorías de país', () => {
    const snapshot = JSON.parse(readFileSync(new URL('../data/artist-country-stats.json', import.meta.url), 'utf8'))
    assert.equal(snapshot.totalArtists, 230)
    assert.equal(snapshot.countries.reduce((sum: number, row: { count: number }) => sum + row.count, 0), 230)
    assert.equal(snapshot.countries.length, 21)
  })
})
