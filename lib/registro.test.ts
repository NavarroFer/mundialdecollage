import { describe, expect, it } from 'vitest'
import { parseRegistro, type RegistroCell } from '@/lib/registro'

const cells = (...texts: string[]): RegistroCell[] => texts.map((text) => ({ text }))
const row = cells('Ana', 'Argentina', 'ana@example.com', 'https://drive.google.com/file/d/abc123/view')

describe('parseRegistro header', () => {
  it('accepts the canonical header', () => {
    const [entry] = parseRegistro([cells('Nombre', 'País', 'Email', 'Obra (Foto en Drive)'), row])
    expect(entry).toMatchObject({ name: 'Ana', email: 'ana@example.com', country_raw: 'Argentina' })
  })

  it('ignores case, accents and extra spaces', () => {
    expect(parseRegistro([cells(' nombre', 'Pais', 'EMAIL ', 'Obra  (foto en drive)'), row])).toHaveLength(1)
  })

  it("accepts a Sheets table's Columna N placeholders in place", () => {
    expect(parseRegistro([cells('Columna 1', 'País', 'Column 3', 'Obra (Foto en Drive)'), row])).toHaveLength(1)
  })

  it('stops on a reordered header', () => {
    expect(() => parseRegistro([cells('Nombre', 'Email', 'País', 'Obra (Foto en Drive)'), row])).toThrow(/encabezado/)
  })

  it('stops on a placeholder in the wrong position', () => {
    expect(() => parseRegistro([cells('Nombre', 'Columna 3', 'Email', 'Obra (Foto en Drive)'), row])).toThrow(/encabezado/)
  })

  it('reads the optional Título and Instagram columns', () => {
    const [entry] = parseRegistro([
      cells('Nombre', 'País', 'Email', 'Obra (Foto en Drive)', 'Titulo', 'Instagram'),
      cells('Ana', 'Argentina', 'ana@example.com', 'https://drive.google.com/file/d/abc123/view', 'Sin fin', '@ana.collage'),
    ])
    expect(entry).toMatchObject({ title: 'Sin fin', instagram: 'ana.collage' })
  })

  it('does not treat @gmail.com as an Instagram handle', () => {
    const [entry] = parseRegistro([
      cells('Nombre', 'País', 'Email', 'Obra (Foto en Drive)', 'Titulo', 'Instagram'),
      cells('Artista', 'Argentina', 'artista@example.com', 'https://drive.google.com/file/d/abc123/view', 'Obra', '@gmail.com'),
    ])
    expect(entry.instagram).toBeNull()
  })
})
