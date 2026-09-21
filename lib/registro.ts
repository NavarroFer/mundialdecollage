// Google Sheets' displayed filename is not its Drive URL. The connector
// snapshot keeps both so importing a smart chip never loses the file ID.
export type RegistroCell = { text: string; url?: string }
export type RegistroEntry = {
  name: string | null
  email: string
  drive_url: string
  country_raw: string | null
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

export function parseRegistro(rows: RegistroCell[][]): RegistroEntry[] {
  const header = rows[0]?.map((c) => c.text.trim())
  if (header?.join('|') !== 'Nombre|País|Email|Obra (Foto en Drive)') {
    throw new Error('Cambió el encabezado de Registro; no se modificó la base.')
  }
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
