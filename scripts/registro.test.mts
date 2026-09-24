import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { driveFileId, parseRegistro, planRegistro, type RegistroCell } from '../lib/registro.ts'

const header = ['Nombre', 'País', 'Email', 'Obra (Foto en Drive)'].map((text) => ({ text }))
const row = (id: string, email = ' ARTISTA@example.com '): RegistroCell[] => [
  { text: 'Artista' }, { text: 'Argentina' }, { text: email },
  { text: 'mi collage.jpg', url: `https://drive.google.com/file/d/${id}/view?usp=drivesdk` },
]

describe('Registro curado', () => {
  it('conserva varias obras del mismo email y extrae enlaces de fichas', () => {
    const result = parseRegistro([header, row('first'), row('second')])
    assert.equal(result.length, 2)
    assert.equal(result[0].email, 'artista@example.com')
    assert.equal(result[0].drive_url, 'https://drive.google.com/file/d/first/view')
  })
  it('reconoce el mismo archivo con distintos formatos de enlace', () => {
    assert.equal(driveFileId('https://drive.google.com/open?id=first'), 'first')
    assert.equal(planRegistro(parseRegistro([header, row('first')]), [
      { id: 'old', drive_url: 'https://drive.google.com/file/d/first/view?usp=sharing' },
    ]).insert, 0)
  })
  it('archiva sólo lo que falta en la lista, sin deduplicar por email', () => {
    assert.deepEqual(planRegistro(parseRegistro([header, row('first'), row('second')]), [
      { id: 'keep', drive_url: 'https://drive.google.com/file/d/first/view' },
      { id: 'obsolete', drive_url: 'https://drive.google.com/file/d/old/view' },
    ]), { total: 2, contacts: 1, insert: 1, restore: 0, archive: ['obsolete'] })
  })
  it('frena si faltan enlaces o hay datos inválidos, vacíos o repetidos', () => {
    assert.throws(() => parseRegistro([header, [...row('first').slice(0, 3), { text: 'foto.jpg' }]]))
    assert.throws(() => parseRegistro([header, row('first', 'mal email')]))
    assert.throws(() => parseRegistro([header]))
    assert.throws(() => parseRegistro([header, row('first'), row('first')]))
  })
  it('rechaza dominios ajenos y carpetas', () => {
    assert.equal(driveFileId('https://evil.test/file/d/id/view'), null)
    assert.equal(driveFileId('https://drive.google.com/drive/folders/id'), null)
  })
  it('lee el título de la columna E solo si la planilla la tiene', () => {
    const conTitulo = [...header, { text: 'Titulo' }]
    const [conDato, sinDato] = parseRegistro([conTitulo, [...row('first'), { text: ' Raíces ' }], [...row('second'), { text: '' }]])
    assert.equal(conDato.title, 'Raíces')
    assert.equal(sinDato.title, null)
    // Sin la columna (una copia vieja de la planilla) no se envía la clave,
    // así la base conserva los títulos que ya tiene.
    assert.equal('title' in parseRegistro([header, row('first')])[0], false)
    assert.equal('title' in parseRegistro([[...header, { text: 'Notas' }], [...row('first'), { text: 'x' }]])[0], false)
  })
  it('restaura una obra reintroducida sin volver a insertarla', () => {
    assert.deepEqual(planRegistro(parseRegistro([header, row('first')]), [
      { id: 'old', drive_url: 'https://drive.google.com/file/d/first/view', archived_at: '2026-09-21' },
    ]), { total: 1, contacts: 1, insert: 0, restore: 1, archive: [] })
  })
})
