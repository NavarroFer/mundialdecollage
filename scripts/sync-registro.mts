// node --env-file=.env.local --import ./scripts/node-project-imports.mjs scripts/sync-registro.mts [snapshot.json] [--apply] [--allow-large-archive]
// snapshot.json is the complete Registro A:D grid as {text,url}[][],
// including the header. Without it, the grid is read live from Google Sheets
// (same path as the /api/cron/registro job). Native chips, never CSV.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { syncRegistro } from '../lib/registro-sync.ts'
import { readSheetGrid } from '../lib/google-sheets.ts'
import { REGISTRO_SHEET_ID, REGISTRO_TAB } from '../lib/registro.ts'

const args = process.argv.slice(2)
const snapshotPath = args.find((arg) => !arg.startsWith('--'))
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Faltan credenciales Supabase en .env.local.')
const db = createClient(url, key, { auth: { persistSession: false } })
const rows = snapshotPath
  ? JSON.parse(readFileSync(snapshotPath, 'utf8'))
  : await readSheetGrid(process.env.REGISTRO_SHEET_ID || REGISTRO_SHEET_ID, REGISTRO_TAB)

const report = await syncRegistro(db, rows, {
  apply: args.includes('--apply'),
  allowLargeArchive: args.includes('--allow-large-archive'),
  log: (line) => console.log(JSON.stringify(line)),
  async saveBackup(backup) {
    const backupDir = join(process.cwd(), '.local', 'registro-backups')
    mkdirSync(backupDir, { recursive: true, mode: 0o700 })
    const backupPath = join(backupDir, `${new Date().toISOString().replaceAll(':', '-')}.json`)
    writeFileSync(backupPath, JSON.stringify(backup), { mode: 0o600 })
    return backupPath
  },
})
if (report.images?.failed) process.exitCode = 2
