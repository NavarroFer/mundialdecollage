import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildArtistCountryStats } from '../lib/artist-country-stats.ts'

const registroHeader = ['Nombre', 'País', 'Email', 'Obra (Foto en Drive)']
describe('artistas por país de Registro', () => {
  it('cuenta una vez por correo, independientemente de obras y filas repetidas', () => {
    assert.deepEqual(buildArtistCountryStats([
      registroHeader,
      ['Ana', 'Argentina', ' ANA@example.com ', 'foto1\nfoto2'],
      ['Ana', 'Argentina', 'ana@example.com', 'foto3'],
      ['Otra', 'Chile', 'otra@example.com', 'foto4'],
    ]), { totalArtists: 2, countries: [{ country: 'Argentina', count: 1 }, { country: 'Chile', count: 1 }] })
  })
  it('agrupa a quienes no tienen país', () => {
    const stats = buildArtistCountryStats([registroHeader,
      ['A', '', 'a@example.com', 'foto'],
      ['B', 'Chile', 'b@example.com', 'foto'],
    ])
    assert.ok(stats.countries.some(row => row.country === 'Sin país registrado' && row.count === 1))
  })
  it('rechaza conflictos, correos inválidos y una fuente vacía o equivocada', () => {
    assert.throws(() => buildArtistCountryStats([registroHeader,
      ['A', 'Chile', 'a@example.com', 'foto'], ['A', 'Perú', 'a@example.com', 'foto'],
    ]), /países distintos/)
    assert.throws(() => buildArtistCountryStats([registroHeader, ['A', '', 'inválido']]), /correo inválido/)
    assert.throws(() => buildArtistCountryStats([registroHeader]), /vacía/)
    assert.throws(() => buildArtistCountryStats([['Nombre', 'País', 'Email']]), /Encabezado/)
  })
  it('el snapshot suma su total y todos tienen país', () => {
    const snapshot = JSON.parse(readFileSync(new URL('../data/artist-country-stats.json', import.meta.url), 'utf8'))
    assert.equal(snapshot.countries.reduce((sum: number, row: { count: number }) => sum + row.count, 0), snapshot.totalArtists)
    assert.ok(!snapshot.countries.some((row: { country: string }) => row.country === 'Sin país registrado' || row.country.includes('/')))
  })
})
