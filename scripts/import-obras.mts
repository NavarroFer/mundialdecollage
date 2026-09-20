// One-off importer for new rows in the "Registro" shape (Nombre, País,
// Email, Obra con link de Drive) into public.legacy_submissions — the
// standalone-script equivalent of pasting into /admin/obras's "Cargar
// nuevas obras" textarea, which calls importLegacySubmissions (see
// app/admin/obras/actions.ts) with "Nombre | Email | Drive | País" lines.
//
// Mirrors that action exactly, including its side effect: every unique
// email in the batch also gets upserted into public.contacts with
// source 'obra_email', same as the UI path, so someone who only ever
// emailed in an obra still ends up reachable from the newsletter.
//
// NOT deduped by email — unlike import-contactos.mts, one person can send
// several obras, so every row survives; drive_url (unique in the DB) is
// the dedupe key, matching legacy_submissions' own constraint. Doesn't
// touch image fetching — that's the separate storeLegacyArtworkGlobally
// step the admin already triggers from /admin/obras after import.
//
// Usage:
//   node --env-file=.env.local scripts/import-obras.mts <archivo.csv>              # dry run
//   node --env-file=.env.local scripts/import-obras.mts <archivo.csv> --apply      # escribe de verdad
//
// Needs NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (--env-file las
// carga desde .env.local sin agregar dotenv).

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Mirrors lib/resend.ts's EMAIL_RE — duplicated because this runs standalone
// via `node`, outside Next's bundler, so it can't use "@/..." aliases.
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

// Placeholder values the sheet uses for "no country given" — these aren't
// real place names, so they're dropped to null instead of stored as
// country_raw (which the admin UI shows verbatim next to each row; showing
// "Sin especificar" there would read as if that were the country).
const NON_COUNTRY_VALUES = new Set(['sin especificar', 'no especificado', 'no informado', 'a revisar', 's/d', ''])

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

type ParsedObra = { email: string; name: string | null; driveUrl: string; countryRaw: string | null }

function loadObrasFromCsv(csvPath: string): {
  obras: ParsedObra[]
  skipped: { line: number; reason: string }[]
} {
  const raw = readFileSync(csvPath, 'utf8').replace(/^﻿/, '')
  const rows = parseCsv(raw)

  const headerIdx = rows.findIndex((r) => r[0]?.trim() === 'Nombre')
  if (headerIdx === -1) {
    throw new Error('No encontré una fila de encabezado con "Nombre" en el CSV.')
  }
  const header = rows[headerIdx].map((h) => h.trim())
  const nombreIdx = header.indexOf('Nombre')
  const paisIdx = header.indexOf('País')
  const emailIdx = header.indexOf('Email')
  const obraIdx = header.findIndex((h) => h.startsWith('Obra'))
  if (emailIdx === -1) throw new Error('No encontré una columna "Email" en el encabezado del CSV.')
  if (obraIdx === -1) throw new Error('No encontré una columna "Obra" (link de Drive) en el encabezado del CSV.')

  const seenDriveUrls = new Set<string>()
  const obras: ParsedObra[] = []
  const skipped: { line: number; reason: string }[] = []

  rows.slice(headerIdx + 1).forEach((r, i) => {
    const line = headerIdx + 2 + i
    if (r.every((cell) => cell.trim() === '')) return

    const email = (r[emailIdx] ?? '').trim().toLowerCase()
    const name = (r[nombreIdx] ?? '').trim() || null
    const driveUrl = (r[obraIdx] ?? '').trim()
    const countryCell = (r[paisIdx] ?? '').trim()
    const countryRaw = NON_COUNTRY_VALUES.has(countryCell.toLowerCase()) ? null : countryCell

    if (!EMAIL_RE.test(email)) {
      skipped.push({ line, reason: `mail inválido o vacío: "${r[emailIdx] ?? ''}"` })
      return
    }
    if (!driveUrl) {
      skipped.push({ line, reason: `sin link de Drive (${email})` })
      return
    }
    if (seenDriveUrls.has(driveUrl)) {
      skipped.push({ line, reason: `link de Drive duplicado dentro del CSV: ${driveUrl}` })
      return
    }
    seenDriveUrls.add(driveUrl)
    obras.push({ email, name, driveUrl, countryRaw })
  })

  return { obras, skipped }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const csvPath = args.find((a) => !a.startsWith('--'))
  if (!csvPath) {
    console.error('Uso: node --env-file=.env.local scripts/import-obras.mts <archivo.csv> [--apply]')
    process.exitCode = 1
    return
  }

  console.log(`Leyendo ${csvPath}...`)
  const { obras, skipped } = loadObrasFromCsv(csvPath)

  console.log(`\nParseadas: ${obras.length} obras con mail y link de Drive válidos.`)
  if (skipped.length > 0) {
    console.log(`Omitidas: ${skipped.length}`)
    for (const s of skipped) console.log(`  línea ${s.line}: ${s.reason}`)
  }

  const uniqueContacts = new Map<string, string | null>()
  for (const o of obras) {
    if (!uniqueContacts.has(o.email)) uniqueContacts.set(o.email, o.name)
  }

  if (!apply) {
    console.log('\nDry run (no se escribió nada). Registros que se importarían a legacy_submissions:')
    for (const o of obras) {
      console.log(`  ${o.name ?? '(sin nombre)'} <${o.email}> — país: ${o.countryRaw ?? '(sin dato)'} — ${o.driveUrl}`)
    }
    console.log(`\nTambién se upsertearían ${uniqueContacts.size} contactos únicos en public.contacts (source: obra_email).`)
    console.log('Corré de nuevo con --apply para escribir esto de verdad.')
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Corré con: node --env-file=.env.local scripts/import-obras.mts <csv> --apply',
    )
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  console.log(`\nUpserteando ${obras.length} filas en legacy_submissions (onConflict: drive_url, ignoreDuplicates: true)...`)
  const { error: legacyError } = await supabase.from('legacy_submissions').upsert(
    obras.map((o) => ({
      email: o.email,
      name: o.name,
      drive_url: o.driveUrl,
      country_raw: o.countryRaw,
    })),
    { onConflict: 'drive_url', ignoreDuplicates: true },
  )
  if (legacyError) {
    console.error('Falló el upsert de legacy_submissions:', legacyError.message)
    process.exitCode = 1
    return
  }

  console.log(`Upserteando ${uniqueContacts.size} contactos en public.contacts (source: obra_email)...`)
  const { error: contactsError } = await supabase.from('contacts').upsert(
    [...uniqueContacts.entries()].map(([email, name]) => ({ email, name, source: 'obra_email' })),
    { onConflict: 'email', ignoreDuplicates: true },
  )
  if (contactsError) {
    console.error('Falló el upsert de contacts (legacy_submissions sí se escribió):', contactsError.message)
    process.exitCode = 1
    return
  }

  console.log('Listo. Las imágenes de Drive todavía no se copiaron — eso lo dispara el botón de buscar imágenes pendientes en /admin/obras.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
