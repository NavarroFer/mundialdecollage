// Preselection (20261126120000_preselection.sql): the marks are closed to
// visitors, and preselection_send leaves exactly the final obras as
// «Preseleccionada» in both tables, only for the service role.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const file = '20261126120000_preselection.sql'
const before = await applyMigrations(db, file)
console.log('failed before:', before.map((f) => f[0]))
await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))

const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
await db.exec(`
  insert into auth.users(id, email) values ('${u(900)}', 'artista@x.invalid');
  insert into public.profiles(id, name) values ('${u(900)}', 'Artista') on conflict (id) do nothing;
  insert into public.artworks(id, profile_id, slug, title, image_url, review_status) values
    ('${u(1)}', '${u(900)}', 'a1', 'A1', 'https://x.invalid/1.jpg', 'preselected'),
    ('${u(2)}', '${u(900)}', 'a2', 'A2', 'https://x.invalid/2.jpg', 'rejected'),
    ('${u(3)}', '${u(900)}', 'a3', 'A3', 'https://x.invalid/3.jpg', 'unreviewed');
  insert into public.legacy_submissions(id, email, name, drive_url, review_status) values
    ('${u(11)}', 'l1@x.invalid', 'L1', 'https://drive.google.com/file/d/aaa/view', 'preselected'),
    ('${u(12)}', 'l2@x.invalid', 'L2', 'https://drive.google.com/file/d/bbb/view', 'unreviewed');
  insert into public.preselection_marks(stage, slot_key, picked, batch) values (1, 'artwork:${u(1)}', true, 1);
`)

async function as(role, sql) {
  await db.exec(`set role ${role}`)
  try { return JSON.stringify((await db.query(sql)).rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
const status = async () => JSON.stringify((await db.query(`
  select 'a' || right(id::text, 2) as k, review_status from public.artworks
  union all select 'l' || right(id::text, 2), review_status from public.legacy_submissions order by 1`)).rows.map((r) => `${r.k}=${r.review_status}`))

console.log('anon reads marks           :', await as('anon', 'select * from public.preselection_marks'))
console.log('authenticated reads marks  :', await as('authenticated', 'select count(*) from public.preselection_marks'))
console.log('authenticated writes marks :', await as('authenticated', `insert into public.preselection_marks(stage, slot_key) values (2, 'artwork:${u(1)}')`))
console.log('authenticated calls send   :', await as('authenticated', `select public.preselection_send(array[]::uuid[], array[]::uuid[])`))
console.log('bad slot key               :', await as('service_role', `insert into public.preselection_marks(stage, slot_key) values (1, 'x')`))
console.log('bad stage                  :', await as('service_role', `insert into public.preselection_marks(stage, slot_key) values (4, 'artwork:${u(1)}')`))
console.log('before send                :', await status())
console.log('service_role sends 3,12    :', await as('service_role', `select public.preselection_send(array['${u(3)}']::uuid[], array['${u(12)}']::uuid[]) as sent`))
console.log('after send                 :', await status())
console.log('send again, same           :', await as('service_role', `select public.preselection_send(array['${u(3)}']::uuid[], array['${u(12)}']::uuid[]) as sent`))
console.log('upsert keeps picked        :', await as('service_role', `insert into public.preselection_marks(stage, slot_key, batch) values (1, 'artwork:${u(1)}', 2) on conflict (stage, slot_key) do update set batch = excluded.batch returning picked, batch`))
