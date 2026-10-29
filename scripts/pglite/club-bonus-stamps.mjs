import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const id = (n) => `00000000-0000-4000-8000-00000000000${n}`
const M1 = id(1), M2 = id(2), C = id(3)       // members 1 and 2, collector
await db.exec(`insert into auth.users(id,email) values ('${M1}','m1@x.invalid'),('${M2}','m2@x.invalid'),('${C}','c@x.invalid');
 insert into public.profiles(id,name,is_public) values ('${M1}','M1',false),('${M2}','M2',false),('${C}','C',true);
 insert into public.customers(email,full_name) values ('c@x.invalid','C');
 insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
   select id,'mercadopago','s'||n,'mp:club',  'pending',null from public.customers, generate_series(1,2) n;`)
await db.exec(`insert into public.club_galleries(user_id,subscription_id,slug,title,host_avatar_id,status)
   select '${M1}', (select id from public.subscriptions where provider_subscription_id='s1'), 'g1','G1','Female_Adult_01','active';
 insert into public.club_galleries(user_id,subscription_id,slug,title,host_avatar_id,status)
   select '${M2}', (select id from public.subscriptions where provider_subscription_id='s2'), 'g2','G2','Female_Adult_01','active';`)
const a = (n) => `a0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`
// five museum obras (selected, public profile), club obras: g1 -> c1,c2 ; g2 -> d1 ; plus one hung nowhere
await db.exec(`insert into public.artworks(id,profile_id,slug,image_url,title,is_selected) values
 ${[1,2,3,4,5].map((n) => `('${a(n)}','${C}','m${n}','u','Museum ${n}',true)`).join(',')},
 ('${a(11)}','${M1}','c1','u','Club 1',false),('${a(12)}','${M1}','c2','u','Club 2',false),('${a(21)}','${M2}','d1','u','Club D',false),('${a(30)}','${M2}','hidden','u','Hung nowhere',false);
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id,1,'${a(11)}' from public.club_galleries where slug='g1';
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id,2,'${a(12)}' from public.club_galleries where slug='g1';
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id,1,'${a(21)}' from public.club_galleries where slug='g2';`)
async function collect(slug, who = C) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${who}',false)`)
  try { const r = await db.query('select * from public.collect_gallery_artwork_stamp($1)', [slug]); return `${r.rows[0].status}/left ${r.rows[0].remaining}` }
  catch (e) { return 'ERROR: ' + e.message.split('\n')[0] } finally { await db.exec('reset role') }
}
console.log('museum 1,2,3          :', await collect('m1'), '|', await collect('m2'), '|', await collect('m3'))
console.log('museum 4 (over limit) :', await collect('m4'))
console.log('club g1 first (bonus) :', await collect('c1'))
console.log('club g1 second        :', await collect('c2'))
console.log('club g2 first (bonus) :', await collect('d1'))
console.log('again c1              :', await collect('c1'))
console.log('hung nowhere          :', await collect('hidden'))
const rows = await db.query("select a.slug, c.is_bonus from public.artwork_stamp_collections c join public.artworks a on a.id=c.artwork_id order by a.slug")
console.log('stored                :', JSON.stringify(rows.rows.map((r) => `${r.slug}${r.is_bonus ? '*' : ''}`)))
// bonus does not take a slot: fresh collector
const F = id(4)
await db.exec(`insert into auth.users(id,email) values ('${F}','f@x.invalid')`)
console.log('fresh: bonus then 3   :', await collect('c1', F), '|', await collect('m1', F), '|', await collect('m2', F), '|', await collect('m3', F), '|', await collect('m4', F))
