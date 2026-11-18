// public_jury() (20261117150000_jury_public.sql): nothing while the jury is
// not published, then only active jurors with name, country and position, and
// only the presentation columns; the jurors table stays closed to visitors.
import { readFileSync } from 'node:fs'
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const before = await applyMigrations(db, '20261117150000_jury_public.sql')
console.log('failed before:', before.map((f) => f[0]))
await db.exec(readFileSync(new URL('../../supabase/migrations/20261117150000_jury_public.sql', import.meta.url), 'utf8'))

await db.exec(`
  insert into public.jurors(email,name,country_code,job_title,bio_short,bio_long) values
    ('a@x.invalid','Ana','AR','Curadora','corta','larga'),
    ('b@x.invalid',null,'BR','Sin nombre',null,null),
    ('c@x.invalid','Carla','MX',null,null,null);
  insert into public.jurors(email,name,country_code,job_title,active) values ('d@x.invalid','Dani','CL','Inactivo',false);
`)

async function as(role, sql) {
  await db.exec(`set role ${role}`)
  try { return JSON.stringify((await db.query(sql)).rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
console.log('unpublished, anon          :', await as('anon', 'select name from public.public_jury()'))
await db.exec(`update public.jury_state set published_at = now() where id`)
console.log('published, anon            :', await as('anon', 'select name, country_code, bio_short from public.public_jury()'))
console.log('published, authenticated   :', await as('authenticated', 'select count(*) from public.public_jury()'))
console.log('columns returned           :', (await db.query('select * from public.public_jury()')).fields.map((f) => f.name).join(','))
console.log('anon reads jurors table    :', await as('anon', 'select email from public.jurors'))
console.log('anon reads jury_state      :', await as('anon', 'select published_at is not null as published from public.jury_state'))
console.log('anon writes jury_state     :', await as('anon', 'update public.jury_state set published_at = null'))
await db.exec(`update public.jury_state set published_at = null where id`)
console.log('unpublished again, anon    :', await as('anon', 'select name from public.public_jury()'))
