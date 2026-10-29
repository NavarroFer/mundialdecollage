import { boot, applyMigrations } from './harness.mjs'
const db = await boot()
const failed = await applyMigrations(db)
console.log('failed:', failed.map((f) => f[0]))
const A='11111111-1111-1111-1111-111111111111', B='22222222-2222-2222-2222-222222222222', V='33333333-3333-3333-3333-333333333333', W='44444444-4444-4444-4444-444444444444'
const art = (n) => `a0000000-0000-4000-8000-00000000000${n}`
await db.exec(`insert into auth.users(id,email) values ('${A}','a@x.invalid'),('${B}','b@x.invalid'),('${V}','v@x.invalid'),('${W}','w@x.invalid');
 insert into public.profiles(id,name,is_public) values ('${A}','A',false),('${B}','B',false),('${V}','V',false),('${W}','W',false);
 insert into public.customers(email,full_name) values ('c@x.invalid','C');
 insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
   select id,'mercadopago','s1','mp:club','pending',null from public.customers limit 1;
 insert into public.club_galleries(user_id,subscription_id,slug,title,host_avatar_id,status) select '${A}', id, 'g-a','A','Female_Adult_01','active' from public.subscriptions limit 1;
 insert into public.artworks(id,profile_id,slug,image_url,title,is_selected) values
  ('${art(1)}','${A}','a1','u','Hung one',false),('${art(2)}','${A}','a2','u','Hung two',false),('${art(3)}','${A}','a3','u','Not hung',false),('${art(4)}','${B}','b1','u','Other member',false);
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id,1,'${art(1)}' from public.club_galleries;
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id,2,'${art(2)}' from public.club_galleries;`)
// attention recorded for club-hung (not selected, profile not public) and for a non-hung one
const visit = (n) => `b0000000-0000-4000-8000-00000000000${n}`
await db.exec(`select public.record_gallery_attention('${V}','${visit(1)}','[{"slug":"a1","mode":"view","milliseconds":6000,"episodes":2},{"slug":"a1","mode":"details","milliseconds":4000,"episodes":1},{"slug":"a3","mode":"view","milliseconds":9000,"episodes":3}]'::jsonb)`)
await db.exec(`select public.record_gallery_attention('${W}','${visit(2)}','[{"slug":"a1","mode":"view","milliseconds":2000,"episodes":1},{"slug":"a2","mode":"view","milliseconds":3000,"episodes":1}]'::jsonb)`)
const rec = await db.query("select a.slug, g.mode, g.milliseconds from public.gallery_attention g join public.artworks a on a.id=g.artwork_id order by 1,2")
console.log('recorded       :', JSON.stringify(rec.rows.map((r) => `${r.slug}/${r.mode}/${r.milliseconds}`)))
await db.exec(`insert into public.artwork_stamp_collections(user_id,artwork_id) values ('${V}','${art(1)}'),('${W}','${art(1)}'),('${V}','${art(2)}');
 insert into public.artwork_likes(artwork_id,email) values ('${art(1)}','v@x.invalid'),('${art(1)}','w@x.invalid');`)
async function as(uid, role, sql) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false), set_config('request.jwt.claims','{"role":"${role}"}',false);`)
  try { return JSON.stringify((await db.query(sql)).rows) } catch (e) { return 'ERROR: ' + e.message.split('\n')[0] } finally { await db.exec('reset role') }
}
const q = "select slot, slug, viewers, view_seconds, details_seconds, stamps, likes from public.club_gallery_stats(now() - interval '30 days')"
console.log('owner stats    :', await as(A, 'authenticated', q))
console.log('other member   :', await as(B, 'authenticated', q))
console.log('anon           :', await as(A, 'anon', q))
console.log('since tomorrow :', await as(A, 'authenticated', "select slot, viewers, stamps, likes from public.club_gallery_stats(now() + interval '1 day')"))
console.log('raw attention  :', await as(A, 'authenticated', 'select * from public.gallery_attention'))
