// 20261126140000_artwork_slug_redirects.sql: obra slugs past 80 characters
// are cut at the last whole word (unique), the old ones lead to the obra
// through renamed_artwork_slug(), and the redirects table stays closed.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const file = '20261126140000_artwork_slug_redirects.sql'
const before = await applyMigrations(db, file)
console.log('failed before:', before.map((f) => f[0]))

const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const long = 'lucrecia-adela-la-geisha-y-el-cisne-collage-2026-descripcion-tecnica-tecnica-collage-s-carton-gris-estilo-reinterpretacion-tridimensional'
const sameStart = long.slice(0, 81) + 'otra-cosa-distinta'
const oneWord = 'a'.repeat(120)
await db.exec(`
  insert into auth.users(id, email) values ('${u(900)}', 'x@x.invalid');
  insert into public.profiles(id, name) values ('${u(900)}', 'X') on conflict (id) do nothing;
  insert into public.artworks(id, profile_id, slug, title, image_url) values
    ('${u(1)}', '${u(900)}', '${long}', 'T1', 'https://x.invalid/1.jpg'),
    ('${u(2)}', '${u(900)}', '${sameStart}', 'T2', 'https://x.invalid/2.jpg'),
    ('${u(3)}', '${u(900)}', '${oneWord}', 'T3', 'https://x.invalid/3.jpg'),
    ('${u(4)}', '${u(900)}', 'corta-normal', 'T4', 'https://x.invalid/4.jpg');
`)
await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))

const rows = (await db.query(`select right(id::text, 1) as id, slug, length(slug) as len from public.artworks order by id`)).rows
for (const r of rows) console.log(`artwork ${r.id}: ${r.len} ${r.slug}`)
async function as(role, sql) {
  await db.exec(`set role ${role}`)
  try { return JSON.stringify((await db.query(sql)).rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
console.log('anon: old long slug ->', await as('anon', `select public.renamed_artwork_slug('${long}') as now`))
console.log('anon: unknown slug  ->', await as('anon', `select public.renamed_artwork_slug('nada') as now`))
console.log('anon reads table    :', await as('anon', 'select * from public.artwork_slug_redirects'))
console.log('redirects           :', (await db.query('select count(*)::int as n from public.artwork_slug_redirects')).rows[0].n)
await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
console.log('run again, redirects:', (await db.query('select count(*)::int as n from public.artwork_slug_redirects')).rows[0].n)
