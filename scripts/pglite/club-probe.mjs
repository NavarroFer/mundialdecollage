// The scenarios of scripts/test-club-galleries-db.mts (credits, daily cap, spend,
// unlock checks, digital payment, monthly bonus, pause, grants) run on PGlite.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { boot, applyMigrations } from './harness.mjs'
const repo = fileURLToPath(new URL('../..', import.meta.url))
const db = await boot()
const failed = await applyMigrations(db, '20261029120000_club_galleries.sql')
console.log('before club, failed:', failed)
await db.exec(`insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','probe@example.invalid') on conflict do nothing; insert into public.profiles(id,name) values ('11111111-1111-1111-1111-111111111111','Probe') on conflict do nothing;`)
const seeded = await db.query("select count(*)::int n from public.profiles")
console.log('profiles after seeding user:', seeded.rows[0].n)
const script = readFileSync(`${repo}/scripts/test-club-galleries-db.mts`, 'utf8')
const probe = script.split('${migration}')[1].split('rollback;`')[0]
const migration = readFileSync(`${repo}/supabase/migrations/20261029120000_club_galleries.sql`, 'utf8')
try {
  const res = await db.exec('begin;\n' + migration + probe + 'rollback;')
  console.log('RESULT', JSON.stringify(res.filter((r) => r.rows?.length).map((r) => r.rows)))
} catch (e) { console.log('FAILED:', e.message) }
