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
  it('acepta el encabezado "Columna N" de una tabla de Sheets, no uno cambiado', () => {
    const tabla = [{ text: 'Columna 1' }, ...header.slice(1)]
    assert.equal(parseRegistro([tabla, row('first')]).length, 1)
    assert.throws(() => parseRegistro([[{ text: 'Columna 2' }, ...header.slice(1)], row('first')]), /encabezado/)
    assert.throws(() => parseRegistro([[header[1], header[0], ...header.slice(2)], row('first')]), /encabezado/)
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
  it('lee el Instagram de la columna F solo si está escrito como usuario o link', () => {
    const encabezado = [...header, { text: 'Titulo' }, { text: 'Instagram' }]
    const conIg = (id: string, ig: string) => [...row(id), { text: '' }, { text: ig }]
    const [arroba, link, plano, provisorio, nuestro] = parseRegistro([encabezado,
      conIg('a', '@lu.gomez'), conIg('b', 'https://www.instagram.com/ana.collage?igsh=x'),
      conIg('c', 'Souvenir'), conIg('d', 'No informado'), conIg('e', '@tehacefaltacollage_')])
    assert.equal(arroba.instagram, 'lu.gomez')
    assert.equal(link.instagram, 'ana.collage')
    assert.equal(plano.instagram, null) // un título que quedó en la columna
    assert.equal(provisorio.instagram, null)
    assert.equal(nuestro.instagram, null)
    assert.equal('instagram' in parseRegistro([header, row('first')])[0], false)
  })
  it('restaura una obra reintroducida sin volver a insertarla', () => {
    assert.deepEqual(planRegistro(parseRegistro([header, row('first')]), [
      { id: 'old', drive_url: 'https://drive.google.com/file/d/first/view', archived_at: '2026-09-21' },
    ]), { total: 1, contacts: 1, insert: 0, restore: 1, archive: [] })
  })
})
