// An obra post cannot be reported. A photo still can, and three reports hide it.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'

const FILE = '20261112160000_no_report_obra.sql'
const KNOWN = new Set(['20261009010000_home_stats_broadcast.sql'])
const A = '00000000-0000-4000-8000-0000000000a1'
const B = '00000000-0000-4000-8000-0000000000b1'
const C = '00000000-0000-4000-8000-0000000000c1'
const D = '00000000-0000-4000-8000-0000000000d1'
const ART = '00000000-0000-4000-8000-0000000000e1'
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
  insert into auth.users (id, email) values ('${A}', 'a@x.invalid'), ('${B}', 'b@x.invalid'), ('${C}', 'c@x.invalid'), ('${D}', 'd@x.invalid');
  insert into public.profiles (id, name, is_public, onboarded_at) values
    ('${A}', 'Ana', true, now()), ('${B}', 'Beto', true, now()), ('${C}', 'Cata', true, now()), ('${D}', 'Dani', true, now());
  insert into public.artworks (id, profile_id, title, slug, image_url, is_selected)
    values ('${ART}', '${A}', 'Recortes', 'recortes', 'https://x.invalid/obra.jpg', true);
`)
const obra = (await db.query(`insert into public.posts (profile_id, kind, artwork_id) values ('${A}', 'artwork', '${ART}') returning id`)).rows[0].id
const photo = (await db.query(`insert into public.posts (profile_id, kind, image_path) values ('${A}', 'photo', '${A}/foto.jpg') returning id`)).rows[0].id
let refused = false
try {
  await db.exec(`insert into public.post_reports (post_id, user_id, reason) values ('${obra}', '${B}', 'no')`)
} catch (error) {
  refused = String(error.message).includes('cannot be reported')
}
const obraRow = (await db.query(`select status, report_count from public.posts where id = '${obra}'`)).rows[0]
check('an obra cannot be reported', refused && obraRow.status === 'published' && obraRow.report_count === 0, JSON.stringify(obraRow))
await db.exec(`
  insert into public.post_reports (post_id, user_id) values
    ('${photo}', '${B}'), ('${photo}', '${C}'), ('${photo}', '${D}');
`)
const hidden = (await db.query(`select status, report_count from public.posts where id = '${photo}'`)).rows[0]
check('three reports still hide a photo', hidden.status === 'hidden' && hidden.report_count === 3, JSON.stringify(hidden))

if (failures.length) {
  console.log(failures.join('\n'))
  process.exit(1)
}
console.log('obra reports blocked')
