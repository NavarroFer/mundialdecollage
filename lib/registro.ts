import { instagramHandle } from '@/lib/instagram'

// Google Sheets' displayed filename is not its Drive URL. The connector
// snapshot keeps both so importing a smart chip never loses the file ID.
export type RegistroCell = { text: string; url?: string }

// The curated, read-only source of truth; the Registro tab is canonical.
export const REGISTRO_SHEET_ID = '1OsmZcP9F4AwIZTJpLq-uzJ__Hv-D0MyoenELXFGqFxM'
export const REGISTRO_TAB = 'Registro'
export type RegistroEntry = {
  name: string | null
  email: string
  drive_url: string
  country_raw: string | null
  // Only present when the sheet has its "Titulo" column (E): an entry
  // without the key leaves stored titles alone (see sync_curated_registro).
  title?: string | null
  // Same for the "Instagram" column (F): the bare handle.
  instagram?: string | null
}

// Only a value written as "@handle" or a profile link counts: older imports
// left titles and notes in this column.
function registroInstagram(value: string | undefined): string | null {
  const raw = value?.trim() ?? ''
  return /^@|instagram\.com\//i.test(raw) ? instagramHandle(raw) : null
}

export function driveFileId(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') return null
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]
      ?? (['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : null)
    return id && /^[\w-]+$/.test(id) ? id : null
  } catch {
    return null
  }
}

const REGISTRO_HEADER = ['Nombre', 'País', 'Email', 'Obra (Foto en Drive)']

// Case, accents and spacing don't matter ("Pais", "EMAIL ", "Obra (foto en
// drive)"): a hand edit of the header shouldn't stop the sync.
function headerKey(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

// Turning the range into a Sheets table renames empty or replaced header
// cells to "Columna N". That placeholder still marks the right position, so
// only a different name (a reordered or swapped column) stops the sync.
function isRegistroHeader(header: string[]) {
  return REGISTRO_HEADER.every((name, i) =>
    headerKey(header[i] ?? '') === headerKey(name) || new RegExp(`^colum(na|n) ${i + 1}$`, 'i').test(headerKey(header[i] ?? '')),
  )
}

export function parseRegistro(rows: RegistroCell[][]): RegistroEntry[] {
  const header = rows[0]?.map((c) => c.text.trim())
  if (!header || !isRegistroHeader(header)) {
    throw new Error('Cambió el encabezado de Registro; no se modificó la base.')
  }
  const hasTitles = /^t[ií]tulo/i.test(header[4] ?? '')
  const hasInstagram = /instagram/i.test(header[5] ?? '')
  const seen = new Set<string>()
  const entries: RegistroEntry[] = []
  rows.slice(1).forEach((row, index) => {
    if (row.every((c) => !c.text?.trim() && !c.url)) return
    const email = row[2]?.text.trim().toLowerCase() ?? ''
    const id = driveFileId(row[3]?.url || row[3]?.text || '')
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || !id) {
      throw new Error(`Fila ${index + 2}: email o enlace de Drive inválido; no se modificó la base.`)
    }
    if (seen.has(id)) throw new Error(`Fila ${index + 2}: archivo repetido en la planilla; revisar la curación.`)
    seen.add(id)
    const country = row[1]?.text.trim() || null
    entries.push({
      name: row[0]?.text.trim() || null,
      email,
      drive_url: `https://drive.google.com/file/d/${id}/view`,
      country_raw: country && !['sin especificar', 'no especificado', 'no informado', 'a revisar', 's/d'].includes(country.toLowerCase()) ? country : null,
      ...(hasTitles ? { title: row[4]?.text.trim() || null } : {}),
      ...(hasInstagram ? { instagram: registroInstagram(row[5]?.text) } : {}),
    })
  })
  if (!entries.length) throw new Error('Registro está vacío; no se modificó la base.')
  return entries
}

export function planRegistro(entries: RegistroEntry[], existing: { id: string; drive_url: string | null; archived_at?: string | null }[]) {
  const wanted = new Set(entries.map((e) => driveFileId(e.drive_url)))
  const known = new Set(existing.map((e) => driveFileId(e.drive_url ?? '')))
  return {
    total: entries.length,
    contacts: new Set(entries.map((e) => e.email)).size,
    insert: entries.filter((e) => !known.has(driveFileId(e.drive_url))).length,
    restore: existing.filter((e) => e.archived_at && wanted.has(driveFileId(e.drive_url ?? ''))).length,
    archive: existing.filter((e) => !e.archived_at && !wanted.has(driveFileId(e.drive_url ?? ''))).map((e) => e.id),
  }
}
