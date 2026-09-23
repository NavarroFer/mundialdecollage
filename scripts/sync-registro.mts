// node --env-file=.env.local --import ./scripts/node-project-imports.mjs scripts/sync-registro.mts <snapshot.json> [--apply] [--allow-large-archive]
// snapshot.json is the complete Registro A:D grid as {text,url}[][],
// including the header. Fetch native Google Sheets chips, never CSV.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { parseRegistro, planRegistro } from '../lib/registro.ts'
import { isoNumericToAlpha2 } from '../lib/iso-numeric-country-codes.ts'
import { storeLegacyArtworkGlobally } from '../lib/legacy-submissions.ts'
import { reuseRegistroArtwork } from '../lib/reuse-registro-artwork.ts'

const args = process.argv.slice(2)
const snapshotPath = args.find((arg) => !arg.startsWith('--'))
if (!snapshotPath) throw new Error('Falta el snapshot JSON completo de Registro.')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Faltan credenciales Supabase en .env.local.')
const db = createClient(url, key, { auth: { persistSession: false } })
const normalize = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const names = new Intl.DisplayNames(['es'], { type: 'region' })
const countryCodes = new Map(Object.values(isoNumericToAlpha2).map((code) => [normalize(names.of(code)!), code]))
const entries = parseRegistro(JSON.parse(readFileSync(snapshotPath, 'utf8'))).map((entry) => ({
  ...entry,
  country_code: entry.country_raw ? countryCodes.get(normalize(entry.country_raw)) ?? null : null,
}))

async function readAll(table: string) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from(table).select('*').order('id').range(from, from + 499)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

const existing = await readAll('legacy_submissions')
const plan = planRegistro(entries, existing as { id: string; drive_url: string; archived_at: string | null }[])
console.log(JSON.stringify({ mode: args.includes('--apply') ? 'apply' : 'dry-run', ...plan, archive: plan.archive.length }))
if (!args.includes('--apply')) process.exit(0)

// A persistent local backup precedes every database mutation; it includes
// all fields needed to restore ownership, selections and subscription state.
const backupDir = join(process.cwd(), '.local', 'registro-backups')
mkdirSync(backupDir, { recursive: true, mode: 0o700 })
const backup: Record<string, unknown> = { entries, legacy_submissions: existing }
for (const table of ['artworks', 'profiles', 'contacts']) backup[table] = await readAll(table)
const backupPath = join(backupDir, `${new Date().toISOString().replaceAll(':', '-')}.json`)
writeFileSync(backupPath, JSON.stringify(backup), { mode: 0o600 })

const { data, error } = await db.rpc('sync_curated_registro', {
  entries,
  allow_large_archive: args.includes('--allow-large-archive'),
})
if (error) throw new Error(`Sincronización rechazada: ${error.message}`)
console.log(JSON.stringify({ result: data, backupPath }))

// Reuse the same image validation, size limits and JPEG optimization as
// /admin/obras. Retry failed photos next run without re-inserting the row.
const current = await readAll('legacy_submissions')
const pending = current.filter((row) => !row.archived_at && !row.image_url)
let downloaded = 0
let failed = 0
let reused = 0
for (let i = 0; i < pending.length; i += 4) {
  await Promise.all(pending.slice(i, i + 4).map(async (row) => {
    const result = await storeLegacyArtworkGlobally(db, { id: String(row.id), drive_url: String(row.drive_url) })
    if (result && await reuseRegistroArtwork(db, { id: String(row.id), claimed_by: row.claimed_by as string | null }, result.fingerprint)) reused++
    const { error: imageError } = await db.from('legacy_submissions').update(result
      ? { image_path: result.path, image_url: result.publicUrl, image_fetch_failed_at: null }
      : { image_fetch_failed_at: new Date().toISOString() }).eq('id', row.id)
    if (imageError) throw new Error(`No se guardó el estado de imagen ${row.id}: ${imageError.message}`)
    if (result) downloaded++
    else failed++
  }))
  console.log(JSON.stringify({ imagesProcessed: Math.min(i + 4, pending.length), pendingTotal: pending.length, downloaded, failed, reused }))
}
const { count, error: countError } = await db.from('legacy_submissions')
  .select('id', { count: 'exact', head: true }).is('archived_at', null)
if (countError || count !== entries.length) throw new Error('El total activo no coincide con la planilla; revisar concurrencia.')
console.log(JSON.stringify({ verifiedActive: count, downloaded, failed, reused }))
if (failed) process.exitCode = 2
