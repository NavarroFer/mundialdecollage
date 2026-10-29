// The Club's stamps (20261029230000): the postal stamp only once the
// visitor's attention covers every hung obra, never for one's own gallery,
// once each, and only the collector reads them.
import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const M = '00000000-0000-4000-8000-000000000001', V = '00000000-0000-4000-8000-000000000002', O = '00000000-0000-4000-8000-000000000003'
const a = (n) => `a0000000-0000-4000-8000-00000000000${n}`
await db.exec(`insert into auth.users(id,email) values ('${M}','m@x.invalid'),('${V}','v@x.invalid'),('${O}','o@x.invalid');
 insert into public.profiles(id,name,country_code) values ('${M}','Fer','AR');
 insert into public.club_galleries(user_id,slug,title,host_avatar_id,status,courtesy_granted_at) values ('${M}','fer-g','Taller Fer','Female_Adult_01','active',now());
 insert into public.artworks(id,profile_id,slug,image_url,title,is_club_only) values ('${a(1)}','${M}','c1','u','Uno',true),('${a(2)}','${M}','c2','u','Dos',true);
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id,1,'${a(1)}' from public.club_galleries;
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id,2,'${a(2)}' from public.club_galleries;
 insert into public.gallery_attention_sessions(id,user_id) values ('b0000000-0000-4000-8000-000000000001','${V}');`)
async function as(uid, sql) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false);`)
  try { const r = await db.query(sql); return JSON.stringify(r.rows) }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] }
  finally { await db.exec('reset role') }
}
const postal = "select public.collect_club_stamp('fer-g','postal') as r"
const look = (n) => db.exec(`insert into public.gallery_attention(session_id,artwork_id,mode,milliseconds,episodes) values ('b0000000-0000-4000-8000-000000000001','${a(n)}','view',3000,1)`)
console.log('anon                     :', await as(null, postal))
console.log('nothing looked at        :', await as(V, postal))
await look(1)
console.log('one of two               :', await as(V, postal))
await look(2)
console.log('both                     :', await as(V, postal))
console.log('again                    :', await as(V, postal))
console.log('own gallery              :', await as(M, postal))
console.log('vernissage               :', await as(V, "select public.collect_club_stamp('fer-g','vernissage') as r"))
console.log('bad kind                 :', await as(V, "select public.collect_club_stamp('fer-g','gold') as r"))
console.log('unknown gallery          :', await as(V, "select public.collect_club_stamp('nope','postal') as r"))
console.log('visitor album            :', await as(V, 'select slug, artist_name, country_code, kind from public.my_club_stamps() order by kind'))
console.log('someone else reads them  :', await as(O, 'select * from public.club_stamps'))
console.log('visitor writes one       :', await as(V, `insert into public.club_stamps(user_id,gallery_id,kind) select '${V}', id, 'postal' from public.club_galleries returning kind`))
