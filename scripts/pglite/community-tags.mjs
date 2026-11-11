// Tries 20261112140000_community_tags.sql: comment language columns, obra tags,
// and community_similar. Applied twice.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'

const FILE = '20261112140000_community_tags.sql'
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) console.log('ok ', name)
  else { failures.push(`${name} ${detail}`); console.log('FAIL', name, detail) }
}

const db = await boot()
await applyMigrations(db, FILE)
const sql = readFileSync(new URL(`../../supabase/migrations/${FILE}`, import.meta.url), 'utf8')
await db.exec(sql)
await db.exec(sql)

const A = '00000000-0000-4000-8000-000000000001'
await db.exec(`
  insert into auth.users (id, email) values ('${A}', 'a@x.invalid');
  insert into public.profiles (id, name, is_public, onboarded_at) values ('${A}', 'Ana', true, now());
  select set_config('request.jwt.claims', '{"email":"mundialdecollage@gmail.com"}', false);
  update public.profiles set is_public = true where id = '${A}';
  select set_config('request.jwt.claims', '', false);
`)
const sea = (await db.query(`insert into public.posts (profile_id, kind, image_path, tags) values ('${A}', 'photo', '${A}/mar.jpg', '{mar,naturaleza}') returning id`)).rows[0].id
const city = (await db.query(`insert into public.posts (profile_id, kind, image_path, tags) values ('${A}', 'photo', '${A}/ciudad.jpg', '{ciudad}') returning id`)).rows[0].id
await db.query(`insert into public.posts (profile_id, kind, image_path, tags) values ('${A}', 'photo', '${A}/otra.jpg', '{mar,luz}')`)
const similar = (await db.query(`select id from public.community_similar('{mar}', '${sea}', 6)`)).rows.map((row) => row.id)
check('similar returns the other sea post and not the one being viewed', similar.length === 1 && !similar.includes(sea) && !similar.includes(city), similar.join(','))
const none = (await db.query(`select id from public.community_similar('{}', null, 6)`)).rows
check('no tags means nothing similar', none.length === 0, String(none.length))

if (failures.length) {
  console.log(failures.join('\n'))
  process.exit(1)
}
console.log('community tags ok')
