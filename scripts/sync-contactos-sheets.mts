// Reconciles a connector snapshot from Registro, consultas and
// "Consultas y Dudas" with public.contacts.
//
// Usage:
//   node --env-file=.env.local scripts/sync-contactos-sheets.mts <snapshot.json>
//   node --env-file=.env.local scripts/sync-contactos-sheets.mts <snapshot.json> --apply

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

type SourceEntry = {
  email: string
  name: string | null
  sources: string[]
}

type Contact = {
  id: string
  email: string
  name: string | null
  source: string
  subscribed: boolean
  created_at: string
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const SERVICE_SENDERS = new Set([
  'hello@m.higgsfield.ai',
  'mia@team.higgsfield.ai',
  'welcome@cosmos.so',
])

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isSystemEmail(value: string) {
  const email = normalizeEmail(value)
  const local = email.split('@')[0] ?? ''
  return (
    email === 'mundialdecollage@gmail.com' ||
    SERVICE_SENDERS.has(email) ||
    /(?:^|[-_.])(no-?reply|noreply|mailer-daemon|postmaster)(?:$|[-_.])/.test(local)
  )
}

const args = process.argv.slice(2)
const snapshotPath = args.find((arg) => !arg.startsWith('--'))
if (!snapshotPath) throw new Error('Falta el snapshot JSON consolidado de las hojas.')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Faltan credenciales Supabase en .env.local.')

const raw = JSON.parse(readFileSync(snapshotPath, 'utf8')) as { entries: SourceEntry[] }
const wanted = new Map<string, SourceEntry>()
for (const entry of raw.entries) {
  const email = normalizeEmail(entry.email)
  if (!EMAIL_RE.test(email) || isSystemEmail(email)) continue
  if (!wanted.has(email)) wanted.set(email, { ...entry, email })
}

const db = createClient(url, key, { auth: { persistSession: false } })
const { data, error } = await db
  .from('contacts')
  .select('id,email,name,source,subscribed,created_at')
  .order('email')
if (error) throw new Error(error.message)

const contacts = data as Contact[]
const current = new Map(contacts.map((contact) => [normalizeEmail(contact.email), contact]))
const missing = [...wanted.values()].filter((entry) => !current.has(entry.email))
const systemContacts = contacts.filter((contact) => isSystemEmail(contact.email) && contact.subscribed)

console.log(JSON.stringify({
  mode: args.includes('--apply') ? 'apply' : 'dry-run',
  sheetEmails: wanted.size,
  existingContacts: contacts.length,
  missing: missing.map(({ email, name, sources }) => ({ email, name, sources })),
  systemContactsToUnsubscribe: systemContacts.map(({ id, email, name }) => ({ id, email, name })),
}, null, 2))

if (!args.includes('--apply')) process.exit(0)

const backupDir = join(process.cwd(), '.local', 'contact-backups')
mkdirSync(backupDir, { recursive: true, mode: 0o700 })
const backupPath = join(backupDir, `${new Date().toISOString().replaceAll(':', '-')}.json`)
writeFileSync(backupPath, JSON.stringify({ contacts }, null, 2), { mode: 0o600 })

if (missing.length > 0) {
  const { error: insertError } = await db.from('contacts').upsert(
    missing.map(({ email, name }) => ({
      email,
      name,
      source: 'google_sheets_2026',
    })),
    { onConflict: 'email', ignoreDuplicates: true },
  )
  if (insertError) throw new Error(`No se incorporaron contactos: ${insertError.message}`)
}

if (systemContacts.length > 0) {
  const { error: unsubscribeError } = await db
    .from('contacts')
    .update({ subscribed: false })
    .in('id', systemContacts.map((contact) => contact.id))
  if (unsubscribeError) throw new Error(`No se desuscribieron remitentes técnicos: ${unsubscribeError.message}`)
}

const { data: verified, error: verifyError } = await db
  .from('contacts')
  .select('email,subscribed')
if (verifyError) throw new Error(verifyError.message)
const verifiedByEmail = new Map(verified.map((contact) => [normalizeEmail(contact.email), contact]))
const stillMissing = [...wanted.keys()].filter((email) => !verifiedByEmail.has(email))
const activeSystems = verified.filter((contact) => isSystemEmail(contact.email) && contact.subscribed)
if (stillMissing.length > 0 || activeSystems.length > 0) {
  throw new Error(`Verificación fallida: faltan ${stillMissing.length}; sistemas activos ${activeSystems.length}`)
}

console.log(JSON.stringify({
  applied: true,
  inserted: missing.length,
  unsubscribedSystems: systemContacts.length,
  finalContacts: verified.length,
  backupPath,
}))
