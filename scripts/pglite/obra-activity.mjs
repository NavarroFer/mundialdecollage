// Likes and approved comments move an obra to the front. A pending comment does not.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'

const FILE = '20261113120000_obra_activity.sql'
const KNOWN = new Set(['20261009010000_home_stats_broadcast.sql'])
const A = '00000000-0000-4000-8000-0000000000a1'
const B = '00000000-0000-4000-8000-0000000000b1'
const ART1 = '00000000-0000-4000-8000-0000000000c1'
const ART2 = '00000000-0000-4000-8000-0000000000c2'
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) console.log('ok ', name)
  else { failures.push(`${name} ${detail}`); console.log('FAIL', name, detail) }
}

const db = await boot()
const failed = await applyMigrations(db, FILE)
const unexpected = failed.filter(([file]) => !KNOWN.has(file))
check('earlier migrations apply', unexpected.length === 0, unexpected.map(([file, message]) => `${file} => ${message}`).join('; '))
const sql = readFileSync(new URL(`../../supabase/migrations/${FILE}`, import.meta.url), 'utf8')
await db.exec(sql)
await db.exec(sql)

await db.exec(`
  insert into auth.users (id, email) values ('${A}', 'a@x.invalid'), ('${B}', 'b@x.invalid');
  insert into public.profiles (id, name, is_public, country_code) values
    ('${A}', 'Ana', true, 'AR'), ('${B}', 'Beto', true, 'UY');
  insert into public.artworks (id, profile_id, title, slug, image_url, is_selected, created_at) values
    ('${ART1}', '${A}', 'Una', 'una', 'https://x.invalid/una.jpg', true, now() - interval '2 days'),
    ('${ART2}', '${B}', 'Dos', 'dos', 'https://x.invalid/dos.jpg', true, now() - interval '1 day');
`)
await db.exec(`update public.artworks set last_activity_at = created_at`)
let order = (await db.query(`select slug from public.obra_activity_feed()`)).rows.map((row) => row.slug)
check('newer obra is first before any activity', order[0] === 'dos', order.join(','))
await db.exec(`insert into public.artwork_likes (artwork_id, email) values ('${ART1}', 'fan@x.invalid')`)
order = (await db.query(`select slug from public.obra_activity_feed()`)).rows.map((row) => row.slug)
check('a like moves that obra first', order[0] === 'una', order.join(','))
await db.exec(`insert into public.artwork_comments (artwork_id, user_id, author_name, body, status) values ('${ART2}', '${B}', 'Beto', 'hola', 'pending')`)
order = (await db.query(`select slug from public.obra_activity_feed()`)).rows.map((row) => row.slug)
check('a pending comment does not move the obra', order[0] === 'una', order.join(','))
await db.exec(`update public.artwork_comments set status = 'approved' where body = 'hola'`)
order = (await db.query(`select slug from public.obra_activity_feed()`)).rows.map((row) => row.slug)
check('approving a comment moves the obra first', order[0] === 'dos', order.join(','))

if (failures.length) {
  console.log(failures.join('\n'))
  process.exit(1)
}
console.log('obra activity ok')
