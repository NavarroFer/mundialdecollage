// Read-only audit for duplicate contacts, accounts, artists and artworks.
// node --env-file=.env.local scripts/audit-contactos.mts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Faltan credenciales Supabase en .env.local.')
const db = createClient(url, key, { auth: { persistSession: false } })

async function readAll(table: string, columns: string) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 500) {
    let result: Awaited<ReturnType<typeof requestPage>> | undefined
    for (let attempt = 1; attempt <= 3; attempt++) {
      result = await requestPage(table, columns, from)
      if (!result.error) break
    }
    const { data, error } = result!
    if (error || !data) throw new Error(`${table}: ${error?.message ?? 'sin datos'}`)
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

function requestPage(table: string, columns: string, from: number) {
  return db.from(table).select(columns).range(from, from + 499)
}

function driveFileId(value: string): string | null {
  try {
    const url = new URL(value)
    return url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]
      ?? url.searchParams.get('id')
  } catch {
    return null
  }
}

function duplicateKeys(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }))
}

const contacts = await readAll('contacts', 'id,email,name,subscribed')
const profiles = await readAll('profiles', 'id,name')
const artworks = await readAll('artworks', 'id,profile_id,image_url,archived_at')
const legacy = await readAll('legacy_submissions', 'id,drive_url,archived_at')

const userEmails: string[] = []
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw new Error(`auth.users: ${error.message}`)
  userEmails.push(...data.users.flatMap((user) => user.email ? [user.email.trim().toLowerCase()] : []))
  if (data.users.length < 1000) break
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase()
const activeArtworks = artworks.filter((row) => !row.archived_at)
const activeLegacy = legacy.filter((row) => !row.archived_at)
const result = {
  counts: {
    contacts: contacts.length,
    subscribed: contacts.filter((row) => row.subscribed).length,
    profiles: profiles.length,
    users: userEmails.length,
    activeArtworks: activeArtworks.length,
    activeLegacySubmissions: activeLegacy.length,
  },
  duplicateContactEmails: duplicateKeys(contacts.map((row) => normalize(row.email))),
  duplicateUserEmails: duplicateKeys(userEmails),
  duplicateProfileNames: duplicateKeys(
    profiles.map((row) => normalize(row.name)).filter(Boolean),
  ),
  duplicateArtworkImages: duplicateKeys(
    activeArtworks.map((row) => `${row.profile_id}|${row.image_url}`),
  ),
  duplicateDriveFiles: duplicateKeys(
    activeLegacy.flatMap((row) => {
      const id = driveFileId(String(row.drive_url ?? ''))
      return id ? [id] : []
    }),
  ),
  activeSystemContacts: contacts.filter((row) => {
    if (!row.subscribed) return false
    const email = normalize(row.email)
    const local = email.split('@')[0] ?? ''
    return email === 'mundialdecollage@gmail.com'
      || /(?:^|[-_.])(no-?reply|noreply|mailer-daemon|postmaster)(?:$|[-_.])/.test(local)
  }).map((row) => ({ id: row.id, email: row.email, name: row.name })),
}

console.log(JSON.stringify(result, null, 2))
