// One-off importer for the "Contactos" tab exported from the outreach
// spreadsheet (Mundial de Collage 2026 - Registro de Obras / Contactos) into
// the public.contacts mailing list (see supabase/migrations/20260917000000_
// admin_mailing.sql and app/admin/contactos/actions.ts's importContacts).
//
// Deliberately dumb, matching this project's "import raw, curate in the
// admin UI" pattern used by importLegacySubmissions/importContacts: this
// script only inserts email + name. Curation (unsubscribing, deleting a
// bad row, merging duplicates) happens afterwards at /admin/contactos,
// which already has the buttons for that. País isn't imported — contacts
// has no country column, and country_raw on legacy_submissions is a
// separate, unrelated table for artwork submissions.
//
// Usage:
//   node --env-file=.env.local scripts/import-contactos.mts               # dry run, no writes
//   node --env-file=.env.local scripts/import-contactos.mts --apply       # actually upsert
//   node --env-file=.env.local scripts/import-contactos.mts --apply --source=convocatoria_2026 /path/to/other.csv
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (same pair
// lib/supabase/admin.ts uses) — --env-file loads them from .env.local
// without adding a dotenv dependency.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_CSV_PATH =
  '/Users/fernandonavarro/Downloads/Contactos_Mundial_de_Collage - Contactos.csv'
const DEFAULT_SOURCE = 'contactos_csv_2026'

// Mirrors lib/resend.ts's EMAIL_RE — duplicated here because this script
// runs standalone via `node`, outside Next's bundler, so it can't reach
// the app's "@/..." path aliases.
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') inQuotes = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\r') {
      // swallow; \n (below) closes the row
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

type ParsedContact = { email: string; name: string | null }

function loadContactsFromCsv(csvPath: string): {
  contacts: ParsedContact[]
  skipped: { line: number; reason: string; raw: string[] }[]
} {
  const raw = readFileSync(csvPath, 'utf8').replace(/^﻿/, '')
  const rows = parseCsv(raw)

  // The sheet export has a handful of title/summary rows before the real
  // header, and that header count has already changed once — find it by
  // content instead of hardcoding a line number.
  const headerIdx = rows.findIndex((r) => r[0]?.trim() === 'Nombre')
  if (headerIdx === -1) {
    throw new Error('No encontré una fila de encabezado con "Nombre" en el CSV. ¿Cambió el formato de la planilla?')
  }
  const header = rows[headerIdx].map((h) => h.trim())
  const nombreIdx = header.indexOf('Nombre')
  const mailIdx = header.indexOf('Mail')
  if (mailIdx === -1) {
    throw new Error('No encontré una columna "Mail" en el encabezado del CSV.')
  }

  const seen = new Map<string, string | null>()
  const skipped: { line: number; reason: string; raw: string[] }[] = []

  rows.slice(headerIdx + 1).forEach((r, i) => {
    const line = headerIdx + 2 + i // 1-indexed, matches what a text editor would show
    if (r.every((cell) => cell.trim() === '')) return // blank trailing line

    const email = (r[mailIdx] ?? '').trim().toLowerCase()
    const name = (r[nombreIdx] ?? '').trim() || null

    if (!EMAIL_RE.test(email)) {
      skipped.push({ line, reason: `mail inválido o vacío: "${r[mailIdx] ?? ''}"`, raw: r })
      return
    }
    if (seen.has(email)) {
      skipped.push({ line, reason: `mail duplicado dentro del CSV: ${email}`, raw: r })
      return
    }
    seen.set(email, name)
  })

  return {
    contacts: [...seen.entries()].map(([email, name]) => ({ email, name })),
    skipped,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const sourceArg = args.find((a) => a.startsWith('--source='))
  const source = sourceArg ? sourceArg.slice('--source='.length) : DEFAULT_SOURCE
  const positional = args.find((a) => !a.startsWith('--'))
  const csvPath = positional ?? DEFAULT_CSV_PATH

  console.log(`Leyendo ${csvPath}...`)
  const { contacts, skipped } = loadContactsFromCsv(csvPath)

  console.log(`\nParseados: ${contacts.length} contactos únicos con mail válido.`)
  if (skipped.length > 0) {
    console.log(`Omitidos: ${skipped.length}`)
    for (const s of skipped) {
      console.log(`  línea ${s.line}: ${s.reason}`)
    }
  }

  if (!apply) {
    console.log('\nDry run (no se escribió nada). Primeros 5 registros que se importarían:')
    for (const c of contacts.slice(0, 5)) {
      console.log(`  ${c.name ?? '(sin nombre)'} <${c.email}>`)
    }
    console.log(`\nCorré de nuevo con --apply para upsertear estos ${contacts.length} registros en public.contacts (source: ${source}).`)
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Corré con: node --env-file=.env.local scripts/import-contactos.mts --apply',
    )
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  console.log(`\nUpserteando ${contacts.length} contactos (source: ${source}, onConflict: email, ignoreDuplicates: true)...`)
  const { error } = await supabase.from('contacts').upsert(
    contacts.map((c) => ({ email: c.email, name: c.name, source })),
    { onConflict: 'email', ignoreDuplicates: true },
  )

  if (error) {
    console.error('Falló el upsert:', error.message)
    process.exitCode = 1
    return
  }

  console.log('Listo. Los que ya existían por mail quedaron sin tocar (ignoreDuplicates); revisá /admin/contactos.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
