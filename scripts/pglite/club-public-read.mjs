import { boot, applyMigrations } from './harness.mjs'
const db = await boot(); await applyMigrations(db)
const A='11111111-1111-1111-1111-111111111111'
await db.exec(`insert into auth.users(id,email) values ('${A}','a@x.invalid'); insert into public.profiles(id,name) values ('${A}','A');
 insert into public.customers(email,full_name) values ('c@x.invalid','C');
 insert into public.subscriptions(customer_id,provider,provider_subscription_id,provider_plan_id,status,shipping_address)
   select id,'mercadopago','s1','mp:club','pending',null from public.customers limit 1;
 insert into public.club_galleries(user_id,subscription_id,slug,title,host_avatar_id,status) select '${A}', id, 'g-a','A','Female_Adult_01','draft' from public.subscriptions limit 1;
 insert into public.artworks(id,profile_id,slug,image_url,title) values ('a0000000-0000-4000-8000-000000000001','${A}','a1','u','Hung'),('a0000000-0000-4000-8000-000000000002','${A}','a2','u','NotHung');
 insert into public.club_gallery_hangings(gallery_id,slot,artwork_id) select id,1,'a0000000-0000-4000-8000-000000000001' from public.club_galleries;`)
const q = async (label) => { await db.exec('set role anon'); const r = await db.query("select slug from public.artworks where slug in ('a1','a2') order by slug"); await db.exec('reset role'); console.log(label, JSON.stringify(r.rows.map((x) => x.slug))) }
await q('anon sees, gallery draft  :')
await db.exec("update public.club_galleries set status='active'")
await q('anon sees, gallery active :')
