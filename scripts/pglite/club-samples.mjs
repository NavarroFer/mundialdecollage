// Sample galleries for /club (20261029210000): only an admin marks them,
// only active ones are listed, with the first hung obra as cover.
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const M = '00000000-0000-4000-8000-000000000001', O = '00000000-0000-4000-8000-000000000002'
await db.exec(`insert into auth.users(id,email) values ('${M}','m@x.invalid'),('${O}','o@x.invalid');
 insert into public.profiles(id,name,country_code) values ('${M}','Fer','AR'),('${O}','Otro','UY');
 insert into public.club_galleries(user_id,slug,title,host_avatar_id,status,courtesy_granted_at) values
   ('${M}','fer-g','Taller Fer','Female_Adult_01','active',now()), ('${O}','otro-g','Otro','Female_Adult_01','paused',null);
 insert into public.artworks(id,profile_id,slug,image_url,title,is_club_only) values
   ('a0000000-0000-4000-8000-000000000001','${M}','c1','https://img/1.jpg','Uno',true),('a0000000-0000-4000-8000-000000000002','${M}','c2','https://img/2.jpg','Dos',true);
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id, 2, 'a0000000-0000-4000-8000-000000000001' from public.club_galleries where slug='fer-g';
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id, 1, 'a0000000-0000-4000-8000-000000000002' from public.club_galleries where slug='fer-g';`)
async function as(claims, sql) {
  await db.exec(`set role ${claims ? 'authenticated' : 'anon'}; select set_config('request.jwt.claims','${JSON.stringify(claims ?? {})}',false);`)
  try { const r = await db.query(sql); return JSON.stringify(r.rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
const ADMIN = { email: 'mundialdecollage@gmail.com', role: 'authenticated' }
const id = async (slug) => (await db.query('select id from public.club_galleries where slug = $1', [slug])).rows[0].id
console.log('nothing marked yet        :', await as(null, 'select * from public.club_sample_galleries()'))
console.log('member marks one          :', await as({ email: 'm@x.invalid', role: 'authenticated' }, `select public.set_club_gallery_sample('${await id('fer-g')}', true)`))
console.log('admin marks both          :', await as(ADMIN, `select public.set_club_gallery_sample('${await id('fer-g')}', true) a, public.set_club_gallery_sample('${await id('otro-g')}', true) b`))
console.log('anon lists (active only)  :', await as(null, 'select * from public.club_sample_galleries()'))
console.log('admin list shows the flag :', await as(ADMIN, 'select slug, is_sample, hung from public.admin_club_galleries() order by slug'))
console.log('admin unmarks             :', await as(ADMIN, `select public.set_club_gallery_sample('${await id('fer-g')}', false)`), await as(null, 'select slug from public.club_sample_galleries()'))
